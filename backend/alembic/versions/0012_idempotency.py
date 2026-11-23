"""Идемпотентность: таблица ключей + уникальные связи продаж с заказами

order_fulfillments.egg_sale_id / batch_sale_id получают уникальный индекс (одна продажа
может быть привязана максимум к одному заказу) — защита от дублей на уровне БД.
SQLite не поддерживает ALTER ADD CONSTRAINT — уникальность делаем уникальным
индексом (та же семантика, NULL не мешают). Таблица idempotency_keys хранит ответы
на POST/PUT/DELETE с заголовком Idempotency-Key: повтор запроса (потеря связи,
ретрай) возвращает сохранённый ответ вместо повторного выполнения (§4.7).

Revision ID: 0012_idempotency
Revises: 0011_routes
Create Date: 2026-11-24 20:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0012_idempotency'
down_revision = '0011_routes'


def upgrade() -> None:
    # уникальный индекс вместо UNIQUE CONSTRAINT: SQLite не умеет ALTER ADD CONSTRAINT
    op.create_index(
        'uq_fulfillment_egg_sale', 'order_fulfillments', ['egg_sale_id'], unique=True,
    )
    op.create_index(
        'uq_fulfillment_batch_sale', 'order_fulfillments', ['batch_sale_id'], unique=True,
    )
    op.create_table(
        'idempotency_keys',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('key', sa.String(64), nullable=False),
        sa.Column('method', sa.String(10), nullable=False),
        sa.Column('path', sa.String(500), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=False),
        sa.Column('response_body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_idempotency_key', 'idempotency_keys', ['key'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_idempotency_key', 'idempotency_keys')
    op.drop_table('idempotency_keys')
    op.drop_index('uq_fulfillment_batch_sale', 'order_fulfillments')
    op.drop_index('uq_fulfillment_egg_sale', 'order_fulfillments')
