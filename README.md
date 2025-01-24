# Training Cluster
The schema and flow of stand alne training cluster

#### Notes
Database map
+----------------------------+-------------------+
| Mapping to Client Cluster                     |
+----------------------------+-------------------+
| Shared Statuses:                               |
+----------------------------+-------------------+
| Training Cluster event_type | Client Cluster   |
|                            | state             |
+----------------------------+-------------------+
| training                   | IN_PROGRESS       |
| training_successful        | READY             |
| training_failed            | FAILED            |
+----------------------------+-------------------+

+---------------------------------+-------------------+
| Internal (Not Mapped):                              |
+---------------------------------+-------------------+
| Training Cluster event_type     | Client Cluster    |
|                                 | state             |
+---------------------------------+-------------------+
| in_queue                        | (Not reflected)   |
| model_in_transfer               | (Not reflected)   |
+---------------------------------+-------------------+

Callbacks will only send the shared statuses 
(IN_PROGRESS, READY, FAILED) as per the client’s expectations.
