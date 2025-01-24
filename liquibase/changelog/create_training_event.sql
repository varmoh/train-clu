-- Training cluster database schema
CREATE TABLE training_event_log (
    id SERIAL PRIMARY KEY,
    training_id UUID NOT NULL,
    client_namespace TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'in_queue',               -- Internal
        'training',               -- Shared
        'training_successful',    -- Shared
        'training_failed',        -- Shared
        'model_in_transfer'       -- Internal
    )),
    event_data JSONB NOT NULL,
    callback_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_training_id ON training_event_log (training_id);
CREATE INDEX idx_event_type ON training_event_log (event_type);
