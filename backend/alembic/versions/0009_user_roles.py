"""Роли и активность пользователей (concept §6: admin/user)

Revision ID: 0009_user_roles
Revises: 0008_batch_arrival_age
Create Date: 2026-11-24 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0009_user_roles'
down_revision = '0008_batch_arrival_age'


def upgrade() -> None:
    op.add_column('users', sa.Column('role', sa.String(10), nullable=False, server_default='user'))
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'))
    # первый созданный пользователь — владелец (администратор)
    op.execute("UPDATE users SET role = 'admin' WHERE id = (SELECT MIN(id) FROM users)")


def downgrade() -> None:
    op.drop_column('users', 'is_active')
    op.drop_column('users', 'role')
