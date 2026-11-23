"""Журнал денег: is_auto + источник у транзакций, is_general у категорий, посев «Лечение»

Revision ID: 0005_money_journal
Revises: 0004_app_settings
Create Date: 2026-11-23 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0005_money_journal'
down_revision = '0004_app_settings'


def upgrade() -> None:
    op.add_column(
        'money_categories',
        sa.Column('is_general', sa.Boolean(), nullable=False, server_default=sa.text('0')),
    )
    op.add_column(
        'money_transactions',
        sa.Column('is_auto', sa.Boolean(), nullable=False, server_default=sa.text('0')),
    )
    op.add_column(
        'money_transactions',
        sa.Column('source_type', sa.String(length=30), nullable=True),
    )
    op.add_column(
        'money_transactions',
        sa.Column('source_id', sa.Integer(), nullable=True),
    )
    op.create_index('ix_money_transactions_source', 'money_transactions', ['source_type', 'source_id'])

    # категория «Лечение» (расход) — если её ещё нет
    op.execute(
        "INSERT INTO money_categories (name, kind, is_active, is_general) "
        "SELECT 'Лечение', 'expense', 1, 0 "
        "WHERE NOT EXISTS (SELECT 1 FROM money_categories WHERE name = 'Лечение')"
    )
    # типовые общие категории распределяются по кура-дням
    op.execute(
        "UPDATE money_categories SET is_general = 1 "
        "WHERE kind = 'expense' AND name IN ('Электричество', 'Отопление', 'Вода', 'Аренда')"
    )
    # существующие автотранзакции закупки цыплят помечаем как авто с источником
    op.execute(
        "UPDATE money_transactions SET is_auto = 1, source_type = 'chicks', source_id = batch_id "
        "WHERE batch_id IS NOT NULL AND money_category_id IN "
        "(SELECT id FROM money_categories WHERE name = 'Цыплята')"
    )


def downgrade() -> None:
    op.drop_index('ix_money_transactions_source', table_name='money_transactions')
    op.drop_column('money_transactions', 'source_id')
    op.drop_column('money_transactions', 'source_type')
    op.drop_column('money_transactions', 'is_auto')
    op.drop_column('money_categories', 'is_general')
