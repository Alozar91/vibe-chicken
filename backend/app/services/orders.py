"""Заказы покупателей (docs/concept.md §4.7).

Заказ — план (что и сколько хотели). Факт живёт в обычных продажах:
из заказа создаётся продажа яйца (layers) или продажа продукции партии
(broiler), а связь хранится в order_fulfillments. Статус done ставится
автоматически, когда по всем позициям продано не меньше заказанного,
либо вручную (closed_manually).
"""

from datetime import date as Date, datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import (
    BatchSlaughter,
    BatchSale,
    Buyer,
    EggSale,
    Order,
    OrderFulfillment,
    OrderItem,
    ProductType,
    SlaughterOutput,
)
from app.schemas.layers import EggSaleIn
from app.schemas.orders import (
    OrderDetailOut,
    OrderFulfillmentOut,
    OrderProductSaleIn,
    OrderIn,
    OrderMetrics,
    OrderStatusIn,
)
from app.schemas.broiler import SaleIn
from app.services import broiler as broiler_svc
from app.services import layers as layers_svc


def _get_order(db: Session, obj_id: int) -> Order:
    obj = db.get(Order, obj_id)
    if obj is None:
        raise ValueError("Заказ не найден")
    return obj


def _validate_item(db: Session, data: "Any") -> str:
    """Общая проверка позиции; возвращает нормализованную единицу."""
    if data.kind == "egg":
        return "dozens"
    pt = db.get(ProductType, data.product_type_id)
    if pt is None:
        raise ValueError("Вид продукции не найден")
    return pt.unit


def _normalize_items(db: Session, items: list) -> list[dict]:
    out = []
    for it in items:
        unit = _validate_item(db, it)
        out.append(
            {
                "kind": it.kind,
                "product_type_id": it.product_type_id if it.kind == "product" else None,
                "qty": it.qty,
                "unit": unit,
                "price_per_unit": it.price_per_unit,
            }
        )
    return out


# --- CRUD заказа ---


def list_orders(db: Session) -> list[Order]:
    return list(
        db.scalars(
            select(Order).options(joinedload(Order.buyer)).order_by(Order.date.desc(), Order.id.desc())
        )
    )


def get_order_detail(db: Session, obj_id: int) -> OrderDetailOut:
    order = _get_order(db, obj_id)
    return _to_detail(db, order)


def create_order(db: Session, data: OrderIn) -> Order:
    if db.get(Buyer, data.buyer_id) is None:
        raise ValueError("Покупатель не найден")
    items = _normalize_items(db, data.items)
    obj = Order(date=data.date, buyer_id=data.buyer_id, comment=data.comment, created_at=datetime.now(timezone.utc))
    db.add(obj)
    db.flush()
    for row in items:
        db.add(OrderItem(order_id=obj.id, **row))
    db.commit()
    return obj


def update_order(db: Session, obj_id: int, data: OrderIn) -> Order:
    order = _get_order(db, obj_id)
    if db.get(Buyer, data.buyer_id) is None:
        raise ValueError("Покупатель не найден")
    has_sales = db.scalar(select(OrderFulfillment.id).where(OrderFulfillment.order_id == obj_id).limit(1))
    if has_sales is not None:
        raise ValueError("По заказу уже есть продажи — позиции менять нельзя. Отвяжите продажи в карточке заказа")
    items = _normalize_items(db, data.items)
    order.date = data.date
    order.buyer_id = data.buyer_id
    order.comment = data.comment
    order.items.clear()
    db.flush()
    for row in items:
        db.add(OrderItem(order_id=order.id, **row))
    db.commit()
    return order


def delete_order(db: Session, obj_id: int) -> None:
    order = _get_order(db, obj_id)
    has_sales = db.scalar(select(OrderFulfillment.id).where(OrderFulfillment.order_id == obj_id).limit(1))
    if has_sales is not None:
        raise ValueError("По заказу уже есть продажи — сначала удалите их в карточке заказа")
    db.delete(order)
    db.commit()


def set_status(db: Session, obj_id: int, data: OrderStatusIn) -> Order:
    order = _get_order(db, obj_id)
    order.status = data.status
    order.closed_manually = data.status != "new"
    db.commit()
    return order


def _recompute_status(db: Session, order: Order) -> None:
    """Авто-статус: выполнен, если по всем позициям продано ≥ заказанного.

    Действует только пока заказ не тронут вручную (closed_manually=False)
    и не отменён.
    """
    if order.status == "cancelled" or order.closed_manually:
        return
    db.flush()  # autoflush=False: pending fulfillment должен попасть в SELECT
    detail = _metrics(db, order)
    if all(m.remaining_qty <= 0 for m in detail):
        order.status = "done"
    else:
        order.status = "new"


# --- Метрики заказа ---


def _metrics(db: Session, order: Order) -> list[OrderMetrics]:
    items = db.scalars(select(OrderItem).where(OrderItem.order_id == order.id)).all()
    rows: list[OrderMetrics] = []
    for item in items:
        fulfilled = float(
            db.scalar(
                select(
                    func.coalesce(func.sum(OrderFulfillment.actual_qty), 0)
                ).where(OrderFulfillment.item_id == item.id)
            )
        )
        ordered = float(item.qty)
        pt = db.get(ProductType, item.product_type_id) if item.product_type_id else None
        rows.append(
            OrderMetrics(
                item_id=item.id,
                kind=item.kind,
                unit=item.unit,
                product_type_id=item.product_type_id,
                product_type_name=pt.name if pt else None,
                ordered_qty=ordered,
                fulfilled_qty=round(fulfilled, 3),
                remaining_qty=round(max(0.0, ordered - fulfilled), 3),
                pct=round(fulfilled / ordered * 100, 1) if ordered > 0 else None,
            )
        )
    return rows


def _fulfillment_out(db: Session, f: OrderFulfillment) -> OrderFulfillmentOut:
    """OrderFulfillmentOut с датой/ценой/суммой связанной продажи.

    Нужен и в деталях заказа, и в ответах на создание продажи — иначе
    ResponseValidationError (у ORM-объекта нет sale_date/price/amount).
    """
    if f.sale_kind == "egg_sale":
        sale = db.get(EggSale, f.egg_sale_id)
        price = float(sale.price_per_ten) if sale else 0.0
    else:
        sale = db.get(BatchSale, f.batch_sale_id)
        price = float(sale.price_per_kg) if sale else 0.0
    if sale is None:  # продажа удалена в обход API — связь не показываем
        raise ValueError("Запись не найдена")
    return OrderFulfillmentOut(
        id=f.id,
        item_id=f.item_id,
        sale_kind=f.sale_kind,
        egg_sale_id=f.egg_sale_id,
        batch_sale_id=f.batch_sale_id,
        actual_qty=f.actual_qty,
        unit=f.unit,
        created_at=f.created_at,
        sale_date=sale.date,
        price=price,
        amount=float(sale.total_amount),
    )


def _to_detail(db: Session, order: Order) -> OrderDetailOut:
    rows = list(
        db.scalars(
            select(OrderFulfillment)
            .where(OrderFulfillment.order_id == order.id)
            .order_by(OrderFulfillment.id)
        )
    )
    fulfillments: list[OrderFulfillmentOut] = []
    for f in rows:
        try:
            fulfillments.append(_fulfillment_out(db, f))
        except ValueError:
            continue  # продажа удалена в обход API — связь не показываем
    return OrderDetailOut(
        id=order.id,
        date=order.date,
        buyer=order.buyer,
        status=order.status,
        closed_manually=order.closed_manually,
        comment=order.comment,
        created_at=order.created_at,
        items=order.items,
        fulfillments=fulfillments,
        metrics=_metrics(db, order),
    )


# --- Формирование фактических продаж из заказа ---


def avg_carcass_weight(db: Session) -> float | None:
    """Средний вес тушки по забоям: Σ выхода «Тушка»/Σ забитых голов (все партии)."""
    carcass_ids = list(
        db.scalars(select(ProductType.id).where(ProductType.unit == "pieces"))
    )
    if not carcass_ids:
        return None
    rows = db.execute(
        select(
            BatchSlaughter.head_count,
            func.coalesce(func.sum(SlaughterOutput.kg), 0),
        )
        .join(SlaughterOutput, SlaughterOutput.slaughter_id == BatchSlaughter.id)
        .where(SlaughterOutput.product_type_id.in_(carcass_ids))
        .group_by(BatchSlaughter.id)
    ).all()
    heads = sum(r[0] for r in rows)
    kg = float(sum(r[1] for r in rows))
    if heads <= 0 or kg <= 0:
        return None
    return kg / heads


def create_egg_fulfillment(db: Session, order_id: int, item_id: int, data: EggSaleIn) -> OrderFulfillment:
    """Продажа яйца из заказа: создаёт egg_sales + авто-доход в журнале денег."""
    order = _get_order(db, order_id)
    item = db.get(OrderItem, item_id)
    if item is None or item.order_id != order_id:
        raise ValueError("Позиция заказа не найдена")
    if order.status == "cancelled":
        raise ValueError("Заказ отменён — продажи из него оформлять нельзя")
    if item.kind != "egg":
        raise ValueError("Позиция не является продажей яйца")
    data.buyer_id = order.buyer_id
    sale = layers_svc.create_sale(db, data)
    f = OrderFulfillment(
        order_id=order_id,
        item_id=item_id,
        sale_kind="egg_sale",
        egg_sale_id=sale.id,
        actual_qty=sale.dozens,
        unit="dozens",
        created_at=datetime.now(timezone.utc),
    )
    db.add(f)
    _recompute_status(db, order)
    db.commit()
    return _fulfillment_out(db, f)


def create_product_fulfillment(
    db: Session, order_id: int, item_id: int, batch_id: int, data: OrderProductSaleIn,
    actual_pieces: float | None = None,
) -> OrderFulfillment:
    """Продажа продукции партии из заказа (позиция kind='product').

    actual_pieces — сколько тушек фактически (если unit позиции 'pieces'):
    по умолчанию считается из веса продажи и среднего веса тушки.
    """
    order = _get_order(db, order_id)
    item = db.get(OrderItem, item_id)
    if item is None or item.order_id != order_id:
        raise ValueError("Позиция заказа не найдена")
    if order.status == "cancelled":
        raise ValueError("Заказ отменён — продажи из него оформлять нельзя")
    if item.kind != "product" or item.product_type_id is None:
        raise ValueError("Позиция не является продажей продукции")
    sale = broiler_svc.create_sale(
        db, batch_id,
        SaleIn(
            date=data.date, product_type_id=item.product_type_id, product_kg=data.product_kg,
            price_per_kg=data.price_per_kg, buyer_id=order.buyer_id, total_amount=data.total_amount,
        ),
    )

    if item.unit == "pieces":
        if actual_pieces is None:
            w = avg_carcass_weight(db)
            if w is None:
                raise ValueError("Нет данных о среднем весе тушки — укажите количество штук вручную")
            actual_pieces = round(float(sale.product_kg) / w, 2)
        actual = actual_pieces
    else:
        actual = float(sale.product_kg)

    f = OrderFulfillment(
        order_id=order_id,
        item_id=item_id,
        sale_kind="batch_sale",
        batch_sale_id=sale.id,
        actual_qty=round(actual, 3),
        unit=item.unit,
        created_at=datetime.now(timezone.utc),
    )
    db.add(f)
    _recompute_status(db, order)
    db.commit()
    return _fulfillment_out(db, f)


def delete_fulfillment(db: Session, order_id: int, f_id: int) -> None:
    """Удалить продажу, созданную из заказа (вместе со связью)."""
    order = _get_order(db, order_id)
    f = db.get(OrderFulfillment, f_id)
    if f is None or f.order_id != order_id:
        raise ValueError("Запись не найдена")
    # Сначала снимаем связь: FK order_fulfillments.egg_sale_id / batch_sale_id
    # мешает удалить продажу, пока fulfillment ещё в БД.
    db.delete(f)
    db.flush()
    if f.sale_kind == "egg_sale":
        layers_svc.delete_sale(db, f.egg_sale_id)
    else:
        sale = db.get(BatchSale, f.batch_sale_id)
        if sale is None:
            raise ValueError("Запись не найдена")
        broiler_svc.delete_sale(db, sale.batch_id, f.batch_sale_id)
    _recompute_status(db, order)
    db.commit()
