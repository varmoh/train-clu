-- Insert a new event when the model is being transferred (e.g., moving to the client)
INSERT INTO training_event_log (training_id, client_namespace, event_type, event_data, callback_url)
VALUES (:training_id, :client_namespace, 'model_in_transfer', '{"status": "transferring"}', :callback_url);
