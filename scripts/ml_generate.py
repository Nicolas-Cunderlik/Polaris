#!/usr/bin/env python3
import json
import math
import os
import random
from datetime import datetime, timedelta

SEED = 424242
random.seed(SEED)

CENTER_LAT = 45.5017
CENTER_LNG = -73.5673

NODES_MIN = 8
NODES_MAX = 12
DRONES_MIN = 28
DRONES_MAX = 40
PACKAGES_MIN = 40
PACKAGES_MAX = 60

ALPHA = 1.0
BETA = 0.8
GAMMA = 1.2

OUTPUT_DIR = os.path.join('public', 'mock')
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'scenario.json')


def jitter(center, spread):
    return center + (random.random() * 2 - 1) * spread


def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def transpose(matrix):
    return list(map(list, zip(*matrix)))


def matmul(a, b):
    return [[sum(x * y for x, y in zip(row, col)) for col in zip(*b)] for row in a]


def identity(n):
    return [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]


def invert(matrix):
    n = len(matrix)
    aug = [row[:] + identity(n)[i] for i, row in enumerate(matrix)]

    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(aug[r][col]))
        if abs(aug[pivot][col]) < 1e-12:
            return None
        if pivot != col:
            aug[col], aug[pivot] = aug[pivot], aug[col]

        pivot_val = aug[col][col]
        aug[col] = [v / pivot_val for v in aug[col]]

        for row in range(n):
            if row == col:
                continue
            factor = aug[row][col]
            aug[row] = [rv - factor * cv for rv, cv in zip(aug[row], aug[col])]

    return [row[n:] for row in aug]


def linear_regression_fit(x, y, ridge=1e-3):
    xt = transpose(x)
    xtx = matmul(xt, x)
    for i in range(len(xtx)):
        xtx[i][i] += ridge
    xty = matmul(xt, y)

    inv = invert(xtx)
    if inv is None:
        return None
    return matmul(inv, xty)


def linear_regression_predict(x, coeffs):
    return matmul(x, coeffs)


def score_node(drone, node):
    distance = haversine_km(drone['lat'], drone['lng'], node['lat'], node['lng'])
    battery_cost = (100 - drone['battery']) / 100.0
    load_factor = node['current_load'] / max(1, node['capacity'])
    return ALPHA * distance + BETA * battery_cost + GAMMA * load_factor


def build_nodes(count):
    nodes = []
    for i in range(count):
        nodes.append({
            'id': f'node-mtl-{i+1:02d}',
            'name': f'MTL-Node-{i+1:02d}',
            'lat': jitter(CENTER_LAT, 0.07),
            'lng': jitter(CENTER_LNG, 0.07),
            'capacity': random.randint(4, 8),
            'current_load': random.randint(0, 3),
            'created_at': datetime.utcnow().isoformat() + 'Z'
        })
    return nodes


def build_drones(count):
    drones = []
    for i in range(count):
        drones.append({
            'id': f'drone-mtl-{i+1:03d}',
            'name': f'DR-MTL-{i+1:03d}',
            'company_id': None,
            'lat': jitter(CENTER_LAT, 0.09),
            'lng': jitter(CENTER_LNG, 0.09),
            'battery': random.randint(25, 100),
            'status': 'idle',
            'destination_lat': None,
            'destination_lng': None,
            'current_node_id': None,
            'created_at': datetime.utcnow().isoformat() + 'Z',
            'updated_at': datetime.utcnow().isoformat() + 'Z'
        })
    return drones


def build_packages(count, nodes):
    packages = []
    for i in range(count):
        node = random.choice(nodes)
        packages.append({
            'id': f'pkg-{i+1:03d}',
            'pickup': {
                'lat': jitter(node['lat'], 0.015),
                'lng': jitter(node['lng'], 0.015)
            },
            'dropoff': {
                'lat': jitter(node['lat'], 0.03),
                'lng': jitter(node['lng'], 0.03)
            },
            'assigned_drone_id': None
        })
    return packages


def build_risk_zones():
    return [
        {
            'id': 'risk-circle-01',
            'type': 'circle',
            'center': { 'lat': CENTER_LAT + 0.02, 'lng': CENTER_LNG - 0.01 },
            'radius_m': 700
        },
        {
            'id': 'risk-circle-02',
            'type': 'circle',
            'center': { 'lat': CENTER_LAT - 0.03, 'lng': CENTER_LNG + 0.04 },
            'radius_m': 550
        },
        {
            'id': 'risk-poly-01',
            'type': 'polygon',
            'points': [
                { 'lat': CENTER_LAT + 0.04, 'lng': CENTER_LNG + 0.01 },
                { 'lat': CENTER_LAT + 0.06, 'lng': CENTER_LNG + 0.05 },
                { 'lat': CENTER_LAT + 0.02, 'lng': CENTER_LNG + 0.06 },
                { 'lat': CENTER_LAT + 0.01, 'lng': CENTER_LNG + 0.02 }
            ]
        }
    ]


def route_crosses_risk_zone(route, risk_zones):
    for zone in risk_zones:
        if zone['type'] == 'circle':
            center = zone['center']
            radius_km = zone['radius_m'] / 1000.0
            for point in route:
                if haversine_km(point['lat'], point['lng'], center['lat'], center['lng']) <= radius_km:
                    return True
    return False


def curve_points(start, end, count, bend=0.015):
    mid_lat = (start['lat'] + end['lat']) / 2.0
    mid_lng = (start['lng'] + end['lng']) / 2.0
    dx = end['lng'] - start['lng']
    dy = end['lat'] - start['lat']
    length = math.hypot(dx, dy) or 1.0
    nx = -dy / length
    ny = dx / length
    control = {
        'lat': mid_lat + ny * bend + (random.random() - 0.5) * bend,
        'lng': mid_lng + nx * bend + (random.random() - 0.5) * bend,
    }

    points = []
    for i in range(1, count + 1):
        t = i / (count + 1)
        a = (1 - t) ** 2
        b = 2 * (1 - t) * t
        c = t ** 2
        lat = a * start['lat'] + b * control['lat'] + c * end['lat']
        lng = a * start['lng'] + b * control['lng'] + c * end['lng']
        points.append({'lat': lat, 'lng': lng})
    return points


def build_flight_plans(drones, nodes, packages, risk_zones):
    plans = []
    for drone in drones:
        package = random.choice(packages)
        package['assigned_drone_id'] = drone['id']

        pickup = package['pickup']
        dropoff = package['dropoff']

        best_node = min(nodes, key=lambda n: score_node(drone, n))

        key_points = [
            { 'lat': drone['lat'], 'lng': drone['lng'], 'status': 'depart' },
            { 'lat': pickup['lat'], 'lng': pickup['lng'], 'status': 'pickup' },
            { 'lat': dropoff['lat'], 'lng': dropoff['lng'], 'status': 'dropoff' },
            { 'lat': best_node['lat'], 'lng': best_node['lng'], 'status': 'charging' }
        ]

        rerouted = route_crosses_risk_zone(key_points, risk_zones)
        if rerouted:
            detour = {
                'lat': jitter(CENTER_LAT, 0.08),
                'lng': jitter(CENTER_LNG, 0.08),
                'status': 'reroute'
            }
            key_points.insert(2, detour)

        waypoints = []
        eta = 0
        for idx in range(len(key_points) - 1):
            start = key_points[idx]
            end = key_points[idx + 1]
            waypoints.append({ 'lat': start['lat'], 'lng': start['lng'], 'eta': eta, 'status': start['status'] })

            seg_points = curve_points(start, end, random.randint(4, 8))
            for point in seg_points:
                eta += random.randint(1, 2)
                waypoints.append({ 'lat': point['lat'], 'lng': point['lng'], 'eta': eta, 'status': 'flying' })

            eta += random.randint(2, 4)
            waypoints.append({ 'lat': end['lat'], 'lng': end['lng'], 'eta': eta, 'status': end['status'] })

            if end['status'] in ('pickup', 'dropoff'):
                eta += random.randint(2, 4)
                waypoints.append({ 'lat': end['lat'], 'lng': end['lng'], 'eta': eta, 'status': 'service' })
            if end['status'] == 'charging':
                eta += random.randint(6, 10)
                waypoints.append({ 'lat': end['lat'], 'lng': end['lng'], 'eta': eta, 'status': 'charging' })

        plans.append({
            'drone_id': drone['id'],
            'waypoints': waypoints,
            'rerouted': rerouted
        })

    return plans


def build_congestion_forecast(nodes):
    now = datetime.utcnow()
    feature_rows = []
    targets = []
    for t in range(24):
        for node in nodes:
            base = node['current_load'] / max(1, node['capacity'])
            cap = node['capacity'] / 10.0
            trend = math.sin(t / 3.0)
            noise = (random.random() - 0.5) * 0.08
            target = min(1.0, max(0.0, base + 0.12 * trend + noise))
            feature_rows.append([1.0, base, cap, trend, t / 24.0])
            targets.append([target])

    coeffs = linear_regression_fit(feature_rows, targets)
    if coeffs is None:
        coeffs = [[0.0], [0.6], [0.1], [0.15], [0.05]]

    buckets = []
    for i in range(12):
        bucket_time = (now + timedelta(minutes=10 * i)).isoformat() + 'Z'
        bucket = {
            'timestamp': bucket_time,
            'node_loads': []
        }
        x_rows = []
        for node in nodes:
            base = node['current_load'] / max(1, node['capacity'])
            cap = node['capacity'] / 10.0
            trend = math.sin(i / 3.0)
            x_rows.append([1.0, base, cap, trend, i / 12.0])

        preds = linear_regression_predict(x_rows, coeffs)
        for node, pred in zip(nodes, preds):
            congestion = min(1.0, max(0.0, float(pred[0])))
            bucket['node_loads'].append({
                'node_id': node['id'],
                'congestion': round(congestion, 3)
            })
        buckets.append(bucket)

    return buckets


def main():
    nodes = build_nodes(random.randint(NODES_MIN, NODES_MAX))
    drones = build_drones(random.randint(DRONES_MIN, DRONES_MAX))
    packages = build_packages(random.randint(PACKAGES_MIN, PACKAGES_MAX), nodes)
    risk_zones = build_risk_zones()
    flight_plans = build_flight_plans(drones, nodes, packages, risk_zones)
    congestion_forecast = build_congestion_forecast(nodes)

    scenario = {
        'meta': {
            'seed': SEED,
            'center': { 'lat': CENTER_LAT, 'lng': CENTER_LNG },
            'ml_model': 'linear_regression',
            'generated_at': datetime.utcnow().isoformat() + 'Z'
        },
        'nodes': nodes,
        'drones': drones,
        'packages': packages,
        'flight_plans': flight_plans,
        'risk_zones': risk_zones,
        'congestion_forecast': congestion_forecast
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(scenario, f, indent=2)

    print(f"Wrote {OUTPUT_FILE}")


if __name__ == '__main__':
    main()
