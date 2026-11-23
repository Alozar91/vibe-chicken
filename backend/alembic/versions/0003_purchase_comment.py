"""Комментарий к закупке корма

Revision ID: 0003_purchase_comment
Revises: 033ba5b175af
Create Date: 2025

"""

from alembic import op
import sqlalchemy as sa

revision = "0003_purchase_comment"
down_revision = "033ba5b175af"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("feed_purchases", sa.Column("comment", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("feed_purchases", "comment")
