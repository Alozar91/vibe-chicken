"""Возраст партии при поступлении (подрощенные цыплята)

Revision ID: 0008_batch_arrival_age
Revises: 0007_product_prices
Create Date: 2026-11-24 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0008_batch_arrival_age'
down_revision = '0007_product_prices'


def upgrade() -> None:
    op.add_column(
        'broiler_batches',
        sa.Column('arrival_age_days', sa.Integer(), nullable=False, server_default='1'),
    )


def downgrade() -> None:
    op.drop_column('broiler_batches', 'arrival_age_days')
