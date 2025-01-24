-- Insert a new event when training fails
INSERT INTO training_event_log (training_id, client_namespace, event_type, event_data, callback_url)
VALUES (:training_id, :client_namespace, 'training_failed', '{"status": "error"}', :callback_url);
