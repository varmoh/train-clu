-- Insert a new event when training begins
INSERT INTO training_event_log (training_id, client_namespace, event_type, event_data, callback_url)
VALUES (:training_id, :client_namespace, 'training', '{"status": "in_progress"}', :callback_url);
