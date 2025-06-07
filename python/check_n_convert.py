import json

file_path = "/home/ylee/Workshop/steakoProject/drafts/The Sixth - 2025.json"

with open(file_path, "r") as f:
    data = json.load(f)

    for el in data['elements']:
        # print(el['type'])
        assert()
        if el['type'] == 'action':
            if