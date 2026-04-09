import json
import sqlite3
from pathlib import Path


TABLES = [
    "TenantSettings",
    "Zone",
    "User",
    "Customer",
    "Blacklist",
    "Product",
    "Stock",
    "StockMovement",
    "StockSnapshot",
    "ExpenseType",
    "Order",
    "OrderItem",
    "OrderHistory",
    "CallLog",
    "Expense",
    "Integration",
    "GoogleSheet",
    "DeliveryLocation",
    "DeliveryFeeConfig",
    "SystemSetting",
    "ActivityLog",
    "Wallet",
    "WalletTransaction",
    "WithdrawalRequest",
    "CatalogProduct",
    "CatalogFavorite",
    "SourcingRequest",
    "ApiKey",
    "CallRecording",
    "TwilioSettings",
    "CarrierSettings",
    "NotificationLog",
    "Notification",
    "AgentSession",
    "Invoice",
]


def main() -> None:
    db_path = Path("prisma/dev.db")
    output_path = Path("prisma/production-export.json")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    data = {}
    for table in TABLES:
        rows = conn.execute(f'SELECT * FROM "{table}"').fetchall()
        data[table] = [dict(row) for row in rows]

    output_path.write_text(
        json.dumps(
            {
                "exportedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
                "tables": data,
            },
            indent=2,
            ensure_ascii=True,
        ),
        encoding="utf-8",
    )
    conn.close()
    print(f"Exported SQLite data to {output_path}")


if __name__ == "__main__":
    main()
