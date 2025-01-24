-- Log the initial training event when training is in progress
INSERT INTO training_event_log (training_id, client_namespace, event_type, event_data, callback_url)
VALUES (:training_id, :client_namespace, 'in_queue', '{"status": "queued"}', :callback_url);


