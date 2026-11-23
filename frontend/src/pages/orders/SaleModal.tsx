/** Модалка продажи из заказа — общая для ПК- и мобильной версии. */

import {
  Button,
  CheckboxRow,
  DateInput,
  ErrorBox,
  Modal,
  PriceDictButton,
  Select,
  TextInput,
} from '../../components/ui'
import type { OrderDetailCtl } from './useOrderDetail'

export default function SaleModal({ c }: { c: OrderDetailCtl }) {
  const { order, saleItem, avgKg, fmt } = c
  return (
    <Modal
      open={c.saleOpen}
      title={saleItem ? `Продажа — ${saleItem.kind === 'egg' ? 'яйцо' : 'продукция'}` : 'Продажа'}
      onClose={() => c.setSaleOpen(false)}
    >
      <ErrorBox message={c.sError} />
      {saleItem?.kind === 'egg' ? (
        <div className="space-y-3">
          <DateInput value={c.sDate} onChange={c.setSDate} />
          <TextInput value={c.sDozens} onChange={c.setSDozens} placeholder="десятков (факт)" required />
          <div className="flex items-start gap-2">
            <TextInput value={c.sPriceTen} onChange={c.setSPriceTen} placeholder="цена за десяток" required />
            <PriceDictButton onClick={() => void c.applyDictPrice()} />
          </div>
          <p className="text-xs text-slate-400">
            Покупатель — {order?.buyer.name} (из заказа). Доход попадёт в журнал денег автоматически.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <DateInput value={c.sDate} onChange={c.setSDate} />
          <Select
            value={c.sBatch}
            onChange={(v) => void c.onBatchChange(v)}
            options={[
              { value: '', label: '— выберите партию —' },
              ...c.batches
                .filter((b) => b.status === 'active' || b.status === 'closed')
                .map((b) => ({ value: String(b.id), label: `${b.code} · ${b.cross ?? ''}` })),
            ]}
          />
          <TextInput value={c.sKg} onChange={c.setSKg} placeholder="вес, кг (факт)" required />
          <div>
            <div className="flex items-start gap-2">
              <TextInput value={c.sPriceKg} onChange={c.setSPriceKg} placeholder="цена за кг" required />
              <PriceDictButton onClick={() => void c.applyDictPrice()} />
            </div>
            {saleItem?.unit === 'pieces' && avgKg && c.sPriceKg.trim() !== '' && !Number.isNaN(Number(c.sPriceKg.replace(',', '.'))) && (
              <p className="mt-1 text-xs text-slate-400">
                ≈ {fmt(Number(c.sPriceKg.replace(',', '.')) * avgKg)} ₽/шт при среднем весе тушки {avgKg.toFixed(2)} кг
              </p>
            )}
          </div>
          {saleItem?.unit === 'pieces' && (
            <>
              <CheckboxRow
                checked={c.sPiecesAuto}
                onChange={c.setSPiecesAuto}
                label={
                  avgKg
                    ? `штук считать по среднему весу тушки (${avgKg.toFixed(2)} кг)`
                    : 'штук считать по среднему весу тушки'
                }
              />
              {!c.sPiecesAuto && (
                <TextInput value={c.sPieces} onChange={c.setSPieces} placeholder="штук фактически" />
              )}
            </>
          )}
          <p className="text-xs text-slate-400">
            Покупатель — {order?.buyer.name} (из заказа). Вид продукции берётся из позиции заказа.
          </p>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button onClick={() => void c.submitSale()} disabled={c.busy}>
          Оформить
        </Button>
        <Button kind="secondary" onClick={() => c.setSaleOpen(false)}>
          Отмена
        </Button>
      </div>
    </Modal>
  )
}
