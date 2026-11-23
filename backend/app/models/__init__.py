"""Все модели SQLAlchemy. Импорт регистрирует их в Base.metadata."""

from app.models.broiler import (  # noqa: F401
    BatchFeeding,
    BatchMortality,
    BatchSale,
    BatchSlaughter,
    BatchTreatment,
    BatchWeighing,
    BroilerBatch,
    SlaughterOutput,
)
from app.models.dictionaries import (  # noqa: F401
    Buyer,
    FeedBrand,
    FeedCategory,
    MoneyCategory,
    Place,
    ProductType,
    Vendor,
)
from app.models.layers import (  # noqa: F401
    EggCollection,
    EggSale,
    EggSelfUse,
    FarmWriteoff,
    LayFeeding,
    LayFlock,
    LayFlockChange,
)
from app.models.orders import (  # noqa: F401
    Order,
    OrderFulfillment,
    OrderItem,
)
from app.models.user import User  # noqa: F401
from app.models.settings import AppSetting  # noqa: F401
from app.models.warehouse import (  # noqa: F401
    FeedAdjustment,
    FeedPurchase,
    MoneyTransaction,
)
