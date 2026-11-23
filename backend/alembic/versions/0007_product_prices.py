"""Справочник цен: sale_price у видов продукции + настройка цены яйца

Revision ID: 0007_product_prices
Revises: 0006_orders
Create Date: 2026-11-23 14:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0007_product_prices'
down_revision = '0006_orders'


def upgrade() -> None:
    op.add_column('product_types', sa.Column('sale_price', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('product_types', 'sale_price')
