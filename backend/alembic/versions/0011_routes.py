"""Маршруты доставки (§4.8): таблицы routes, route_stops, route_stop_orders

Revision ID: 0011_routes
Revises: 0010_buyer_coords
Create Date: 2026-11-24 13:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0011_routes'
down_revision = '0010_buyer_coords'


def upgrade() -> None:
    op.create_table(
        'routes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
    )
    op.create_table(
        'route_stops',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('route_id', sa.Integer(), sa.ForeignKey('routes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('buyer_id', sa.Integer(), sa.ForeignKey('buyers.id'), nullable=True),
        sa.Column('label', sa.String(200), nullable=False),
        sa.Column('lat', sa.Float(), nullable=False),
        sa.Column('lon', sa.Float(), nullable=False),
        sa.Column('note', sa.String(500), nullable=True),
    )
    op.create_table(
        'route_stop_orders',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('stop_id', sa.Integer(), sa.ForeignKey('route_stops.id', ondelete='CASCADE'), nullable=False),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('route_stop_orders')
    op.drop_table('route_stops')
    op.drop_table('routes')
