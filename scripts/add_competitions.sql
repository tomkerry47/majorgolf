-- Add US Open 2025
INSERT INTO competitions 
(name, venue, "startDate", "endDate", "selectionDeadline", "isActive", "isComplete", description, "imageUrl")
VALUES 
('US Open 2025', 'Oakmont Country Club, Pennsylvania', '2025-06-12', '2025-06-15', '2025-06-11', false, false, 'The 125th U.S. Open Championship', 'https://golf-assets.com/usopen2025.jpg')
ON CONFLICT (name) DO NOTHING;

-- Add The Open Championship 2025
INSERT INTO competitions 
(name, venue, "startDate", "endDate", "selectionDeadline", "isActive", "isComplete", description, "imageUrl")
VALUES 
('The Open Championship 2025', 'Royal Portrush, Northern Ireland', '2025-07-17', '2025-07-20', '2025-07-16', false, false, 'The 153rd Open Championship', 'https://golf-assets.com/openChampionship2025.jpg')
ON CONFLICT (name) DO NOTHING;

-- Add PGA Championship 2025
INSERT INTO competitions 
(name, venue, "startDate", "endDate", "selectionDeadline", "isActive", "isComplete", description, "imageUrl")
VALUES 
('PGA Championship 2025', 'Quail Hollow Club, North Carolina', '2025-05-15', '2025-05-18', '2025-05-14', false, false, 'The 107th PGA Championship', 'https://golf-assets.com/pgachampionship2025.jpg')
ON CONFLICT (name) DO NOTHING;