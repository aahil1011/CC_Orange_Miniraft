#!/bin/bash

# Tails logs from all containers simultaneously with color coding.

docker-compose logs -f --tail=20 replica1 replica2 replica3 gateway
