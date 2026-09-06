-- BackendBhai: Ecommerce Database Schema
-- Contracts source: contracts/DATA_MODEL.md §2

CREATE TABLE IF NOT EXISTS users (
    id              VARCHAR(50) PRIMARY KEY,
    email           VARCHAR(200) NOT NULL,
    name            VARCHAR(200) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id              VARCHAR(50) PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    price           DECIMAL(10, 2) NOT NULL,
    stock           INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id              VARCHAR(50) PRIMARY KEY,
    user_id         VARCHAR(50) NOT NULL REFERENCES users(id),
    items           JSONB NOT NULL,                  -- Array of {id, name, qty, price}
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- "pending", "paid", "failed", "cancelled"
    total           DECIMAL(10, 2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id              VARCHAR(50) PRIMARY KEY,
    order_id        VARCHAR(50) NOT NULL REFERENCES orders(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- "pending", "completed", "failed"
    amount          DECIMAL(10, 2) NOT NULL,
    provider        VARCHAR(50) NOT NULL DEFAULT 'mock-payment',
    external_id     VARCHAR(100),                    -- External payment provider ID
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);

-- Baseline Seed Data for Demo Environment
INSERT INTO users (id, email, name) VALUES
    ('user-1', 'alex.chen@example.com', 'Alex Chen'),
    ('user-2', 'sarah.connor@example.com', 'Sarah Connor'),
    ('user-3', 'raj.patel@example.com', 'Raj Patel'),
    ('user-4', 'elena.rostova@example.com', 'Elena Rostova'),
    ('user-5', 'marcus.vance@example.com', 'Marcus Vance'),
    ('user-42', 'douglas.adams@example.com', 'Arthur Dent')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, price, stock) VALUES
    ('item-1', 'Mechanical Keyboard (Linear Red Switches)', 89.99, 150),
    ('item-2', 'Ergonomic Wireless Mouse', 49.99, 200),
    ('item-3', '27-inch 4K IPS Monitor', 349.00, 75),
    ('item-4', 'USB-C Multiport Docking Station', 69.50, 120),
    ('item-5', 'Active Noise-Canceling Headphones', 199.99, 90),
    ('item-6', 'Desk Mat (900x400mm Dark Grey)', 24.99, 300),
    ('item-7', 'Aluminum Laptop Stand', 39.99, 180),
    ('item-8', 'HD Webcam 1080p 60fps', 79.99, 110),
    ('item-9', 'Studio Condenser USB Microphone', 119.00, 85),
    ('item-10', 'Monitor Light Bar with Wireless Dial', 59.99, 140),
    ('item-11', 'Braided Thunderbolt 4 Cable 2m', 29.99, 250),
    ('item-12', 'Magnetic Phone Charging Stand (MagSafe)', 34.50, 160),
    ('item-13', 'Ergonomic Mesh Office Chair', 289.00, 40),
    ('item-14', 'Electric Standing Desk Converter', 189.99, 50),
    ('item-15', 'Cable Management Raceway Kit', 18.99, 400),
    ('item-16', 'Smart RGB Desk Ambient Light Strip', 27.99, 210),
    ('item-17', 'GaN 100W Fast Wall Charger (4-Port)', 45.00, 175),
    ('item-18', 'Anti-Static Microfiber Cleaning Cloths (5-Pack)', 9.99, 500),
    ('item-19', 'Bluetooth 5.3 Low-Latency Audio Adapter', 22.50, 130),
    ('item-20', 'Desk Cup Holder with Headphone Hanger', 16.99, 220)
ON CONFLICT (id) DO NOTHING;
