-- Insert a new event when training is successful and the model is generated
INSERT INTO training_event_log (training_id, client_namespace, event_type, event_data, callback_url)
VALUES (:training_id, :client_namespace, 'training_successful', '{"status": "done"}', :callback_url);


