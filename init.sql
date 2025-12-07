CREATE TABLE IF NOT EXISTS inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inventory_name VARCHAR(255) NOT NULL,
    description TEXT,
    photoFile VARCHAR(255)
);
