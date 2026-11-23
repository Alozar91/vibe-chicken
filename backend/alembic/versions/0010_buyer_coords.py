"""Координаты покупателя (маршруты доставки, §4.8)

Revision ID: 0010_buyer_coords
Revises: 0009_user_roles
Create Date: 2026-11-24 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0010_buyer_coords'
down_revision = '0009_user_roles'


def upgrade() -> None:
    op.add_column('buyers', sa.Column('lat', sa.Float(), nullable=True))
    op.add_column('buyers', sa.Column('lon', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('buyers', 'lon')
    op.drop_column('buyers', 'lat')
