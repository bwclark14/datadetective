let db;
let currentDatabase = "people";

document.addEventListener("DOMContentLoaded", async () => {
    const SQL = await initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${file}` });
    db = new SQL.Database();
    createSampleDatabases();
    changeDatabase();
    clearQuery();
   document.getElementById("clear-button").addEventListener("click", clearQuery);

});

function changeDatabase() {
    currentDatabase = document.getElementById("database-select").value;
    document.getElementById("database-title").textContent = `${capitalizeFirstLetter(currentDatabase)} Database`;
    displayTable();
    populateFieldsButtons();
  populateTableButtons();
}

function createSampleDatabases() {
    // Create People table
    db.run(`CREATE TABLE people (surname TEXT, forename TEXT, eye_color TEXT, hair_color TEXT, shoe_size INTEGER, height INTEGER, month_of_birth TEXT, year_of_birth INTEGER);`);
    db.run(`
  INSERT INTO people VALUES 
    ('Brown', 'David', 'blue', 'brown', 8, 140, 'April', 2008),
    ('Miller', 'Sarah', 'hazel', 'red', 4, 95, 'May', 2016),
    ('Taylor', 'John', 'grey', 'blonde', 6, 110, 'October', 2010),
    ('Jones', 'Jennifer', 'brown', 'brunette', 9, 170, 'July', 2003),
  ('Davies', 'Lisa', 'green', 'brown', 3, 85, 'February', 2017),
  ('Lewis', 'Mary', 'hazel', 'red', 5, 100, 'December', 2011),
  ('Clark', 'Elizabeth', 'blue', 'blonde', 7, 130, 'January', 2009),
  ('Walker', 'Margaret', 'grey', 'brunette', 6, 115, 'September', 2010),
  ('Carter', 'Thomas', 'brown', 'black', 8, 145, 'November', 2007),
  ('Robinson', 'Emma', 'green', 'blonde', 5, 100, 'July', 2013),
  
  ('Moore', 'James', 'blue', 'brown', 7, 125, 'March', 2011),
  ('Nelson', 'Ava', 'brown', 'black', 8, 140, 'November', 2007),
('Ward', 'Isabella', 'green', 'blonde', 5, 105, 'July', 2013),
('Baker', 'Jacob', 'blue', 'brown', 7, 125, 'March', 2011),
('Fox', 'Sophie', 'hazel', 'red', 4, 90, 'October', 2015),
('Holt', 'Noah', 'grey', 'blonde', 6, 110, 'April', 2012),
('Rice', 'Amelia', 'brown', 'brunette', 9, 175, 'January', 2002),
('Reed', 'Oliver', 'green', 'brown', 3, 80, 'May', 2018),
('Cooper', 'Mia', 'hazel', 'red', 5, 95, 'December', 2013),
('Cox', 'Ethan', 'blue', 'blonde', 7, 135, 'July', 2008),
('Rogers', 'Lily', 'brown', 'black', 8, 140, 'November', 2007),
('Stevens', 'Oliver', 'green', 'blonde', 5, 105, 'July', 2013),
('Morgan', 'Ava', 'blue', 'brown', 7, 125, 'March', 2011),
('Stewart', 'Isabella', 'hazel', 'red', 4, 90, 'October', 2015),
('Sanders', 'Noah', 'grey', 'blonde', 6, 110, 'April', 2012),
('Clark', 'Amelia', 'brown', 'brunette', 9, 175, 'January', 2002),
('Turner', 'Oliver', 'green', 'brown', 3, 80, 'May', 2018),
('Scott', 'Mia', 'hazel', 'red', 5, 95, 'December', 2013),
('Brooks', 'Ethan', 'blue', 'blonde', 7, 135, 'July', 2008),
('Wilson', 'Lily', 'brown', 'black', 8, 140, 'November', 2007),
('King', 'Oliver', 'green', 'blonde', 5, 105, 'July', 2013),
('Taylor', 'John', 'blue', 'blonde', 6, 110, 'October', 2010),
('Smith', 'Alice', 'blue', 'blonde', 38, 150, 'March', 2010),
('Johnson', 'Michael', 'brown', 'black', 7, 125, 'June', 2014),
('Williams', 'Emily', 'green', 'blonde', 5, 105, 'August', 2012),
('Brown', 'David', 'blue', 'brown', 8, 140, 'April', 2008),
('Miller', 'Sarah', 'hazel', 'red', 4, 95, 'May', 2016)
`);
    
    // Create Cars table
    db.run(`CREATE TABLE cars (registration_no TEXT, make TEXT, model TEXT, fuel_type TEXT, body_style TEXT, owner_name TEXT, owner_city TEXT);`);
    db.run(`INSERT INTO cars VALUES ('LN01 ABC', 'Ford', 'Focus', 'Petrol', 'Hatchback', 'Sophia Robinson', 'Brighton'),
('DV01 DEF', 'Vauxhall', 'Corsa', 'Diesel', 'Hatchback', 'James Turner', 'Birmingham'),
('BF01 GHI', 'Volkswagen', 'Golf', 'Petrol', 'Hatchback', 'Emily Clark', 'Leeds'),
('HF01 JKL', 'BMW', '3 Series', 'Diesel', 'Saloon', 'Oliver Davies', 'Manchester'),
('LF01 MNO', 'Audi', 'A4', 'Petrol', 'Saloon', 'Charlotte Evans', 'Liverpool'),
('BN01 PQR', 'Mercedes-Benz', 'A-Class', 'Diesel', 'Hatchback', 'Jack Harris', 'Newcastle'),
('DN01 STU', 'Toyota', 'Yaris', 'Hybrid', 'Hatchback', 'Lily Walker', 'Bristol'),
('FN01 VWX', 'Nissan', 'Qashqai', 'Petrol', 'SUV', 'Harry Thompson', 'Cardiff'),
('KN01 YZA', 'Kia', 'Sportage', 'Diesel', 'SUV', 'Grace White', 'Sheffield'),
('PN01 ABC', 'Hyundai', 'i30', 'Petrol', 'Hatchback', 'Joshua Taylor', 'Nottingham'),
('LN51 ABC', 'Ford', 'Fiesta', 'Petrol', 'Hatchback', 'Amelia Green', 'Brighton'),
('DV51 DEF', 'Vauxhall', 'Astra', 'Diesel', 'Hatchback', 'Jacob Scott', 'Birmingham'),
('BF51 GHI', 'Volkswagen', 'Passat', 'Diesel', 'Saloon', 'Ella Moore', 'Leeds'),
('HF51 JKL', 'BMW', 'X1', 'Diesel', 'SUV', 'Thomas Young', 'Manchester'),
('LF51 MNO', 'Audi', 'Q5', 'Petrol', 'SUV', 'Isabella Brown', 'Liverpool'),
('BN51 PQR', 'Mercedes-Benz', 'C-Class', 'Petrol', 'Saloon', 'Leo Adams', 'Newcastle'),
('DN51 STU', 'Toyota', 'Corolla', 'Hybrid', 'Saloon', 'Mia Wilson', 'Bristol'),
('FN51 VWX', 'Nissan', 'Juke', 'Petrol', 'SUV', 'William Cook', 'Cardiff'),
('KN51 YZA', 'Kia', 'Ceed', 'Diesel', 'Hatchback', 'Chloe Davies', 'Sheffield'),
('PN51 ABC', 'Hyundai', 'Tucson', 'Diesel', 'SUV', 'Daniel Phillips', 'Nottingham'),
('LN05 ABC', 'Ford', 'Mondeo', 'Diesel', 'Saloon', 'Evie Martin', 'Brighton'),
('DV05 DEF', 'Vauxhall', 'Insignia', 'Petrol', 'Saloon', 'Samuel Collins', 'Birmingham'),
('BF05 GHI', 'Volkswagen', 'Tiguan', 'Diesel', 'SUV', 'Megan Reed', 'Leeds'),
('HF05 JKL', 'BMW', '5 Series', 'Diesel', 'Saloon', 'Alexander Kelly', 'Manchester'),
('LF05 MNO', 'Audi', 'A6', 'Petrol', 'Saloon', 'Sophie Bennett', 'Liverpool'),
('BN05 PQR', 'Mercedes-Benz', 'E-Class', 'Diesel', 'Saloon', 'Benjamin Hall', 'Newcastle'),
('DN05 STU', 'Toyota', 'RAV4', 'Hybrid', 'SUV', 'Isabelle Campbell', 'Bristol'),
('FN05 VWX', 'Nissan', 'Leaf', 'Electric', 'Hatchback', 'Henry Roberts', 'Cardiff'),
('KN05 YZA', 'Kia', 'Picanto', 'Petrol', 'Hatchback', 'Hannah Hughes', 'Sheffield'),
('PN05 ABC', 'Hyundai', 'Santa Fe', 'Diesel', 'SUV', 'George Carter', 'Nottingham'),
('LN55 ABC', 'Ford', 'Kuga', 'Diesel', 'SUV', 'Emily Walker', 'Brighton'),
('DV55 DEF', 'Vauxhall', 'Zafira', 'Petrol', 'MPV', 'Matthew Ward', 'Birmingham'),
('BF55 GHI', 'Volkswagen', 'Polo', 'Petrol', 'Hatchback', 'Emma Turner', 'Leeds'),
('HF55 JKL', 'BMW', 'X3', 'Diesel', 'SUV', 'Joshua Allen', 'Manchester'),
('LF55 MNO', 'Audi', 'A3', 'Petrol', 'Hatchback', 'Olivia Cooper', 'Liverpool'),
('BN55 PQR', 'Mercedes-Benz', 'GLA', 'Diesel', 'SUV', 'Jack King', 'Newcastle'),
('DN55 STU', 'Toyota', 'Aygo', 'Petrol', 'Hatchback', 'Sophie Edwards', 'Bristol'),
('FN55 VWX', 'Nissan', 'Micra', 'Petrol', 'Hatchback', 'James Bell', 'Cardiff'),
('KN55 YZA', 'Kia', 'Niro', 'Hybrid', 'SUV', 'Chloe Murphy', 'Sheffield'),
('PN55 ABC', 'Hyundai', 'Kona', 'Electric', 'SUV', 'Harry Lee', 'Nottingham'),
('LN09 ABC', 'Ford', 'S-Max', 'Diesel', 'MPV', 'Ella Harris', 'Brighton'),
('DV09 DEF', 'Vauxhall', 'Mokka', 'Petrol', 'SUV', 'Daniel Green', 'Birmingham'),
('BF09 GHI', 'Volkswagen', 'Touareg', 'Diesel', 'SUV', 'Grace Johnson', 'Leeds'),
('HF09 JKL', 'BMW', '1 Series', 'Diesel', 'Hatchback', 'Oliver Moore', 'Manchester'),
('LF09 MNO', 'Audi', 'TT', 'Petrol', 'Coupe', 'Lily Brown', 'Liverpool'),
('BN09 PQR', 'Mercedes-Benz', 'S-Class', 'Diesel', 'Saloon', 'Lucas Anderson', 'Newcastle'),
('DN09 STU', 'Toyota', 'Prius', 'Hybrid', 'Hatchback', 'Charlotte Clark', 'Bristol'),
('FN09 VWX', 'Nissan', 'X-Trail', 'Diesel', 'SUV', 'Thomas Lewis', 'Cardiff'),
('KN09 YZA', 'Kia', 'Optima', 'Petrol', 'Saloon', 'Zoe Wilson', 'Sheffield'),
('PN09 ABC', 'Hyundai', 'i40', 'Diesel', 'Saloon', 'Freddie White', 'Nottingham'),
('LN60 ABC', 'Ford', 'Galaxy', 'Diesel', 'MPV', 'Holly Robinson', 'Brighton'),
('DV60 DEF', 'Vauxhall', 'Meriva', 'Petrol', 'MPV', 'Aaron Evans', 'Birmingham'),
('BF60 GHI', 'Volkswagen', 'Scirocco', 'Petrol', 'Coupe', 'Madison Ward', 'Leeds'),
('HF60 JKL', 'BMW', 'Z4', 'Petrol', 'Convertible', 'Mason Young', 'Manchester'),
('LF60 MNO', 'Audi', 'A5', 'Diesel', 'Coupe', 'Lilly Martin', 'Liverpool'),
('BN60 PQR', 'Mercedes-Benz', 'GLC', 'Diesel', 'SUV', 'Ella Davies', 'Newcastle'),
('DN60 STU', 'Toyota', 'C-HR', 'Hybrid', 'SUV', 'Lucas Scott', 'Bristol'),
('FN60 VWX', 'Nissan', 'Navara', 'Diesel', 'Pickup', 'Grace Kelly', 'Cardiff'),
('KN60 YZA', 'Kia', 'Soul', 'Electric', 'Hatchback', 'Ryan Hughes', 'Sheffield'),
('PN60 ABC', 'Hyundai', 'Veloster', 'Petrol', 'Coupe', 'Olivia Anderson', 'Nottingham'),
('LN13 ABC', 'Ford', 'EcoSport', 'Petrol', 'SUV', 'Jayden Allen', 'Brighton'),
('DV13 DEF', 'Vauxhall', 'Adam', 'Petrol', 'Hatchback', 'Layla Phillips', 'Birmingham'),
('BF13 GHI', 'Volkswagen', 'Beetle', 'Petrol', 'Hatchback', 'Sienna Thompson', 'Leeds'),
('HF13 JKL', 'BMW', 'X5', 'Diesel', 'SUV', 'Isaac Green', 'Manchester'),
('LF13 MNO', 'Audi', 'Q7', 'Diesel', 'SUV', 'Harper Hill', 'Liverpool'),
('BN13 PQR', 'Mercedes-Benz', 'B-Class', 'Diesel', 'MPV', 'Ethan Wilson', 'Newcastle'),
('DN13 STU', 'Toyota', 'Land Cruiser', 'Diesel', 'SUV', 'Samantha Lewis', 'Bristol'),
('FN13 VWX', 'Nissan', '370Z', 'Petrol', 'Coupe', 'Adam Evans', 'Cardiff'),
('KN13 YZA', 'Kia', 'Sorento', 'Diesel', 'SUV', 'Freya Roberts', 'Sheffield'),
('PN13 ABC', 'Hyundai', 'Genesis', 'Petrol', 'Saloon', 'Owen Cook', 'Nottingham'),('MH22 XYZ', 'Honda', 'Civic', 'Petrol', 'Hatchback', 'Aarav Sharma', 'Leicester'),
('KK22 WXY', 'Mazda', 'CX-5', 'Diesel', 'SUV', 'Yuna Kim', 'Reading'),
('RJ23 JKL', 'Hyundai', 'Elantra', 'Petrol', 'Saloon', 'Arjun Patel', 'Slough'),
('SC23 LNO', 'Kia', 'Seltos', 'Diesel', 'SUV', 'Priya Singh', 'Coventry'),
('AB23 FGH', 'Suzuki', 'Swift', 'Petrol', 'Hatchback', 'Hassan Ali', 'Bradford'),
('YK22 DEF', 'Toyota', 'Camry', 'Hybrid', 'Saloon', 'Mei Zhang', 'Milton Keynes'),
('WL22 XYZ', 'Nissan', 'Altima', 'Petrol', 'Saloon', 'Ravi Nair', 'Watford'),
('VT22 MNQ', 'Mitsubishi', 'Outlander', 'Diesel', 'SUV', 'Sana Iqbal', 'Luton'),
('LC23 PQR', 'Honda', 'Accord', 'Hybrid', 'Saloon', 'Miguel Santos', 'Southampton'),
('BY23 XYZ', 'Mazda', 'MX-5', 'Petrol', 'Convertible', 'Carlos Alvarez', 'Oxford'),
('CV22 QRS', 'Hyundai', 'Venue', 'Petrol', 'SUV', 'Anika Desai', 'Cambridge'),
('LM23 UVW', 'Toyota', 'Fortuner', 'Diesel', 'SUV', 'Anwar Khan', 'Leicester'),
('NT23 FGD', 'Nissan', 'Maxima', 'Petrol', 'Saloon', 'Dinesh Rao', 'Bournemouth'),
('QH22 KLM', 'Suzuki', 'Vitara', 'Petrol', 'SUV', 'Amina Ahmed', 'Huddersfield'),
('ZJ22 RST', 'Mitsubishi', 'Eclipse Cross', 'Diesel', 'SUV', 'Juan Rodriguez', 'Peterborough'),('ED24 ABC', 'Ford', 'Puma', 'Petrol', 'SUV', 'Liam McGregor', 'Edinburgh'),
('GL24 DEF', 'Vauxhall', 'Grandland', 'Diesel', 'SUV', 'Aisha Khan', 'Glasgow'),
('AB24 GHI', 'Volkswagen', 'T-Roc', 'Petrol', 'SUV', 'Chen Wei', 'Aberdeen'),
('DU24 JKL', 'BMW', '2 Series', 'Diesel', 'Hatchback', 'Maria Sousa', 'Dundee'),
('IN24 MNO', 'Audi', 'Q3', 'Petrol', 'SUV', 'Vikram Singh', 'Inverness'),
('ST24 PQR', 'Mercedes-Benz', 'CLA', 'Diesel', 'Saloon', 'Elena Ivanova', 'Stirling'),
('PE24 STU', 'Hyundai', 'Bayon', 'Petrol', 'SUV', 'Rashid Al-Farsi', 'Perth'),
('FI24 VWX', 'Toyota', 'C-HR', 'Hybrid', 'SUV', 'Anastasia Popova', 'Fife'),
('AR24 YZA', 'Kia', 'Rio', 'Petrol', 'Hatchback', 'Hiroshi Tanaka', 'Arbroath'),
('DU24 BCD', 'Honda', 'Jazz', 'Hybrid', 'Hatchback', 'Nina Patel', 'Dunfermline'),
('ST24 EFG', 'Nissan', 'Juke', 'Petrol', 'SUV', 'Yusuf Ahmed', 'Stirling'),
('AY24 HIJ', 'Suzuki', 'Ignis', 'Petrol', 'Hatchback', 'Paolo Ricci', 'Ayr'),
('GL24 KLM', 'Mitsubishi', 'ASX', 'Diesel', 'SUV', 'Isabel Fernandez', 'Glasgow'),
('ED24 NOP', 'Mazda', '6', 'Diesel', 'Saloon', 'Mohamed El-Sayed', 'Edinburgh'),
('AB24 QRS', 'Volkswagen', 'Tiguan', 'Petrol', 'SUV', 'Tatiana Petrova', 'Aberdeen'),
('IN24 TUV', 'Ford', 'Fiesta', 'Petrol', 'Hatchback', 'Omar Hassan', 'Inverness'),
('FI24 XYZ', 'Kia', 'Stonic', 'Petrol', 'SUV', 'Jia Li', 'Fife'),
('PE24 ABC', 'Toyota', 'Auris', 'Hybrid', 'Hatchback', 'Carlos Gutierrez', 'Perth'),
('AR24 DEF', 'Hyundai', 'Tucson', 'Diesel', 'SUV', 'Fatima Malik', 'Arbroath'),
('DU24 GHI', 'Nissan', 'Qashqai', 'Petrol', 'SUV', 'Sanjay Mehta', 'Dundee'),('GL24 DEF2', 'Peugeot', '3008', 'Diesel', 'SUV', 'Aisha Khan', 'Glasgow'),
('AB24 GHI2', 'Ford', 'Fiesta', 'Petrol', 'Hatchback', 'Chen Wei', 'Aberdeen'),
('IN24 MNO2', 'Honda', 'CR-V', 'Hybrid', 'SUV', 'Vikram Singh', 'Inverness'),
('ST24 PQR2', 'Tesla', 'Model 3', 'Electric', 'Saloon', 'Elena Ivanova', 'Stirling'),
('DU24 JKL2', 'Audi', 'A1', 'Petrol', 'Hatchback', 'Maria Sousa', 'Dundee'),
('FI24 VWX2', 'Skoda', 'Octavia', 'Diesel', 'Saloon', 'Anastasia Popova', 'Fife'),
('AY24 HIJ2', 'Renault', 'Clio', 'Petrol', 'Hatchback', 'Paolo Ricci', 'Ayr');`);
    
    // Create Products table
    db.run(`CREATE TABLE products (product_id INTEGER, name TEXT, category TEXT, price REAL, number_in_stock INTEGER);`);
    db.run(`INSERT INTO products VALUES (1, 'Cordless Vacuum Cleaner', 'Home Appliances', 129.99, 20),
(2, '4-Slice Toaster', 'Kitchen Appliances', 39.99, 15),
(3, 'Electric Kettle', 'Kitchen Appliances', 29.99, 30),
(4, 'Microwave Oven', 'Kitchen Appliances', 89.99, 10),
(5, 'Pressure Cooker', 'Kitchen Appliances', 49.99, 25),
(6, 'Slow Cooker', 'Kitchen Appliances', 39.99, 18),
(7, 'Coffee Maker', 'Kitchen Appliances', 79.99, 12),
(8, 'Air Fryer', 'Kitchen Appliances', 59.99, 22),
(9, 'Stand Mixer', 'Kitchen Appliances', 249.99, 8),
(10, 'Blender', 'Kitchen Appliances', 49.99, 15),
(11, 'Food Processor', 'Kitchen Appliances', 89.99, 10),
(12, 'Rice Cooker', 'Kitchen Appliances', 39.99, 20),
(13, 'Dishwasher', 'Large Appliances', 499.99, 5),
(14, 'Refrigerator', 'Large Appliances', 649.99, 4),
(15, 'Washing Machine', 'Large Appliances', 399.99, 6),
(16, 'Tumble Dryer', 'Large Appliances', 349.99, 3),
(17, 'Air Purifier', 'Home Appliances', 129.99, 10),
(18, 'Heater', 'Home Appliances', 69.99, 15),
(19, 'Ceiling Fan', 'Home Appliances', 89.99, 8),
(20, 'Electric Fireplace', 'Home Appliances', 299.99, 3),
(21, 'Smart TV', 'Electronics', 499.99, 7),
(22, 'Bluetooth Speaker', 'Electronics', 79.99, 25),
(23, 'Streaming Device', 'Electronics', 29.99, 20),
(24, 'Digital Camera', 'Electronics', 399.99, 6),
(25, 'Wireless Headphones', 'Electronics', 129.99, 30),
(26, 'Smart Home Hub', 'Electronics', 99.99, 15),
(27, 'Home Security Camera', 'Home Security', 59.99, 18),
(28, 'Smart Doorbell', 'Home Security', 79.99, 12),
(29, 'Safe', 'Home Security', 69.99, 14),
(30, 'Fire Alarm', 'Home Security', 29.99, 20),
(31, 'First Aid Kit', 'Home Safety', 19.99, 25),
(32, 'Cookware Set', 'Kitchenware', 89.99, 10),
(33, 'Cutlery Set', 'Kitchenware', 39.99, 15),
(34, 'Dinner Plates Set', 'Tableware', 29.99, 20),
(35, 'Glassware Set', 'Tableware', 39.99, 12),
(36, 'Serving Bowls', 'Tableware', 24.99, 30),
(37, 'Baking Tray', 'Baking Supplies', 14.99, 25),
(38, 'Kitchen Scale', 'Kitchen Tools', 19.99, 22),
(39, 'Measuring Cups', 'Kitchen Tools', 9.99, 35),
(40, 'Oven Gloves', 'Kitchen Tools', 12.99, 30),
(41, 'Dish Drying Rack', 'Kitchen Accessories', 19.99, 20),
(42, 'Shower Curtain', 'Bathroom Accessories', 14.99, 15),
(43, 'Bath Mat', 'Bathroom Accessories', 19.99, 20),
(44, 'Towel Set', 'Bathroom Accessories', 29.99, 10),
(45, 'Bathroom Storage', 'Bathroom Furniture', 49.99, 8),
(46, 'Wall Mirror', 'Home Decor', 59.99, 15),
(47, 'Wall Art', 'Home Decor', 39.99, 20),
(48, 'Decorative Vase', 'Home Decor', 24.99, 25),
(49, 'Indoor Plant', 'Home Decor', 19.99, 18),
(50, 'Area Rug', 'Home Furnishings', 99.99, 10),
(51, 'Cushion Set', 'Home Furnishings', 29.99, 15),
(52, 'Throw Blanket', 'Home Furnishings', 19.99, 20),
(53, 'Bed Frame', 'Furniture', 199.99, 5),
(54, 'Mattress', 'Furniture', 299.99, 4),
(55, 'Dresser', 'Furniture', 249.99, 6),
(56, 'Nightstand', 'Furniture', 89.99, 10),
(57, 'Dining Table', 'Furniture', 399.99, 4),
(58, 'Dining Chairs', 'Furniture', 59.99, 12),
(59, 'Office Desk', 'Furniture', 199.99, 6),
(60, 'Office Chair', 'Furniture', 149.99, 8),
(61, 'Bookshelf', 'Furniture', 99.99, 10),
(62, 'Garden Furniture Set', 'Outdoor Furniture', 499.99, 3),
(63, 'Patio Umbrella', 'Outdoor Accessories', 89.99, 10),
(64, 'BBQ Grill', 'Outdoor Cooking', 199.99, 5),
(65, 'Cooler Box', 'Outdoor Accessories', 39.99, 15),
(66, 'Garden Storage Box', 'Outdoor Accessories', 79.99, 8),
(67, 'Bird Feeder', 'Outdoor Accessories', 14.99, 20),
(68, 'Hammock', 'Outdoor Accessories', 49.99, 12),
(69, 'Outdoor Lanterns', 'Outdoor Accessories', 29.99, 25),
(70, 'Garden Hose', 'Outdoor Accessories', 19.99, 20), (71, 'Cordless Stick Vacuum', 'Home Appliances', 149.99, 16),
(72, 'Induction Hob', 'Kitchen Appliances', 329.99, 38),
(73, 'Food Dehydrator', 'Kitchen Appliances', 79.99, 8),
(74, 'Electric Griddle', 'Kitchen Appliances', 49.99, 38),
(75, 'Deep Fryer', 'Kitchen Appliances', 59.99, 16),
(76, 'Electric Can Opener', 'Kitchen Appliances', 29.99, 45),
(77, 'Digital Air Fryer', 'Kitchen Appliances', 89.99, 47),
(78, 'Multi-Cooker', 'Kitchen Appliances', 119.99, 20),
(79, 'Waffle Maker', 'Kitchen Appliances', 39.99, 1),
(80, 'Ice Cream Maker', 'Kitchen Appliances', 69.99, 44),
(81, 'Dish Rack', 'Kitchenware', 24.99, 20),
(82, 'Cutlery Organizer', 'Kitchen Accessories', 19.99, 19),
(83, 'Spice Rack', 'Kitchen Accessories', 29.99, 32),
(84, 'Microwave Cart', 'Furniture', 79.99, 16),
(85, 'Kitchen Island', 'Furniture', 299.99, 18),
(86, 'Dining Set', 'Furniture', 399.99, 28),
(87, 'Wooden Stool', 'Furniture', 29.99, 16),
(88, 'Garden Bench', 'Outdoor Furniture', 149.99, 25),
(89, 'Patio Dining Set', 'Outdoor Furniture', 499.99, 30),
(90, 'Hanging Chair', 'Outdoor Furniture', 199.99, 1),
(91, 'Outdoor Storage Box', 'Outdoor Accessories', 79.99, 31),
(92, 'Grill Cover', 'Outdoor Accessories', 29.99, 44),
(93, 'Patio Heater', 'Outdoor Accessories', 129.99, 28),
(94, 'Fire Pit', 'Outdoor Accessories', 99.99, 40),
(95, 'Garden Fountain', 'Outdoor Decor', 199.99, 41),
(96, 'Wind Chimes', 'Outdoor Decor', 24.99, 24),
(97, 'Garden Lights', 'Outdoor Lighting', 49.99, 45),
(98, 'Solar Lanterns', 'Outdoor Lighting', 39.99, 42),
(99, 'Decorative Plant Pot', 'Garden Decor', 19.99, 24),
(100, 'Outdoor Rug', 'Outdoor Decor', 59.99, 33),
(101, 'Bathrobe', 'Bedding', 29.99, 23),
(102, 'Pillow Protector', 'Bedding', 12.99, 16),
(103, 'Mattress Protector', 'Bedding', 24.99, 28),
(104, 'Duvet Cover Set', 'Bedding', 49.99, 25),
(105, 'Curtains', 'Home Decor', 39.99, 25),
(106, 'Picture Frames', 'Home Decor', 19.99, 30),
(107, 'Wall Decals', 'Home Decor', 14.99, 4),
(108, 'Bookcase', 'Furniture', 99.99, 32),
(109, 'Storage Chest', 'Furniture', 149.99, 5),
(110, 'Coffee Table', 'Furniture', 89.99, 16),
(111, 'TV Stand', 'Furniture', 129.99, 42),
(112, 'Armchair', 'Furniture', 199.99, 39),
(113, 'Shoe Rack', 'Home Organization', 29.99, 25),
(114, 'Laundry Sorter', 'Home Organization', 39.99, 22),
(115, 'Clothes Drying Rack', 'Laundry', 24.99, 14),
(116, 'Ironing Board', 'Laundry', 39.99, 42),
(117, 'Laundry Basket', 'Laundry', 19.99, 6),
(118, 'Tote Bag', 'Home Organization', 14.99, 3),
(119, 'Bin', 'Home Organization', 9.99, 6),
(120, 'Storage Baskets', 'Home Organization', 29.99, 28),
(121, 'Shelf Unit', 'Home Organization', 49.99, 21),
(122, 'Wall Hooks', 'Home Organization', 12.99, 9),
(123, 'Digital Thermometer', 'Kitchen Tools', 19.99, 19),
(124, 'Juicer', 'Kitchen Appliances', 79.99, 45),
(125, 'Beverage Dispenser', 'Kitchen Accessories', 34.99, 24),
(126, 'Mixing Bowls', 'Kitchen Tools', 19.99, 47),
(127, 'Food Storage Containers', 'Kitchen Accessories', 24.99, 7),
(128, 'Salad Spinner', 'Kitchen Tools', 14.99, 13),
(129, 'Chopping Board', 'Kitchen Tools', 19.99, 25),
(130, 'Bottle Opener', 'Kitchen Tools', 9.99, 41),
(131, 'Wine Rack', 'Kitchen Accessories', 29.99, 5),
(132, 'Dishwasher Safe Cutlery', 'Tableware', 39.99, 33),
(133, 'Table Runner', 'Table Decor', 14.99, 22),
(134, 'Napkin Holder', 'Tableware', 12.99, 40),
(135, 'Serving Tray', 'Tableware', 29.99, 43),
(136, 'Cheese Board', 'Kitchen Accessories', 19.99, 39),
(137, 'Chafing Dish', 'Tableware', 39.99, 43),
(138, 'Salt and Pepper Shakers', 'Tableware', 9.99, 49),
(139, 'Candle Holders', 'Home Decor', 24.99, 3),
(140, 'Wreath', 'Home Decor', 29.99, 22),
(141, 'Throw Blanket', 'Home Furnishings', 19.99, 31),
(142, 'Area Rug', 'Home Furnishings', 89.99, 5),
(143, 'Curtain Rod', 'Home Furnishings', 19.99, 46),
(144, 'Faux Fur Throw', 'Home Furnishings', 29.99, 34),
(145, 'Wall Shelf', 'Home Organization', 34.99, 6),
(146, 'Mug Set', 'Kitchenware', 19.99, 23),
(147, 'Cutting Board', 'Kitchen Tools', 24.99, 26),
(148, 'Canisters', 'Kitchen Accessories', 39.99, 6),
(149, 'Salad Bowl', 'Tableware', 19.99, 39),
(150, 'Party Plates', 'Tableware', 14.99, 9),
(151, 'Ice Bucket', 'Kitchen Accessories', 19.99, 11),
(152, 'Coaster Set', 'Home Decor', 12.99, 20),
(153, 'Basketweave Storage', 'Home Organization', 29.99, 33),
(154, 'Hanging Planter', 'Garden Decor', 24.99, 33),
(155, 'Garden Tools', 'Gardening', 34.99, 1);

`);
}

function displayTable() {
    const table = document.getElementById("data-table");
    table.innerHTML = ""; // Clear existing table content

    // Get the current database table data
    const data = db.exec(`SELECT * FROM ${currentDatabase} ORDER BY RANDOM() LIMIT 5`)[0];

    if (!data) {
        table.innerHTML = "<p>No data available.</p>";
        return;
    }

    const headers = data.columns;
    const numberOfFields = headers.length;

    // Check if fieldInfo already exists and remove it if it does
    const existingFieldInfo = document.getElementById("field-info");
    if (existingFieldInfo) {
        existingFieldInfo.remove();
    }

    // Create a new div for field information
    const fieldInfo = document.createElement('div');
    fieldInfo.id = "field-info"; // Set an ID for future reference
    fieldInfo.style.border = '1px solid #000'; // Box border
    fieldInfo.style.padding = '10px'; // Padding inside the box
    fieldInfo.style.textAlign = 'center'; // Center text
    fieldInfo.style.marginBottom = '10px'; // Space below the box

    // Create text for number of fields
    const fieldCountText = `Number of fields: ${numberOfFields}`;
    // Create text for fields list
    const fieldListText = `Fields: ${headers.join(', ')}`;

    // Set the inner HTML of the fieldInfo div
    fieldInfo.innerHTML = `<strong>${fieldCountText}</strong><br><br><strong>${fieldListText}</strong>`;

    // Insert field information above the table
    table.parentNode.insertBefore(fieldInfo, table); // Insert above the table

    // Create header row for the table
    const headerRow = table.insertRow();
    headers.forEach(header => {
        const cell = headerRow.insertCell();
        cell.textContent = header;
        cell.style.fontWeight = "bold";
    });

    // Insert data rows into the table
    data.values.forEach(row => {
        const rowElement = table.insertRow();
        row.forEach(cellData => {
            const cell = rowElement.insertCell();
            cell.textContent = cellData;
        });
    });
}



function populateFieldsButtons() {
  const fieldsContainer = document.getElementById("fields-buttons");
  fieldsContainer.innerHTML = "";

  let fields;
  switch (currentDatabase) {
    case "people":
      fields = ["surname", "forename", "eye_color", "hair_color", "shoe_size", "height", "month_of_birth", "year_of_birth"];
      break;
    case "cars":
      fields = ["registration_no", "make", "model", "fuel_type", "body_style", "owner_name", "owner_city"];
      break;
    case "products":
      fields = ["product_id", "name", "category", "price", "number_in_stock"];
      break;
  }

  fields.forEach(field => {
    const button = document.createElement("button");
    button.textContent = field;
    button.onclick = () => appendSQL(field);
    fieldsContainer.appendChild(button);

    // Add a space between buttons
    fieldsContainer.appendChild(document.createTextNode(" "));
  });
}

function clearQuery() {
    document.getElementById("sql-query").textContent = "";
    document.getElementById("record-message").textContent = "";
    document.getElementById("query-result").innerHTML = "";
    document.getElementById("result-message").textContent = "";
  const recordMessage = document.getElementById("record-message");
    if (recordMessage) {
        recordMessage.remove();
    }
}

let queryHistory = [];

function appendSQL(value) {
    const sqlQueryDiv = document.getElementById("sql-query");
    sqlQueryDiv.textContent += value + " ";
    queryHistory.push(value); // Keep track of added commands
}

function deleteLastWord() {
    if (queryHistory.length > 0) {
        queryHistory.pop(); // Remove the last command from history
        const newQuery = queryHistory.join(" "); // Recreate the query without the last command
        document.getElementById("sql-query").textContent = newQuery + " "; // Update the query display
    }
}

function addNumericValue() {
    const numInput = document.getElementById("number-input").value;
    appendSQL(numInput);
    document.getElementById("number-input").value = "";
}

function addTextValue() {
  const textInput = document.getElementById("text-input").value;
  const formattedText = `'${textInput}'`; // Add quotes around the text
  appendSQL(formattedText);
  document.getElementById("text-input").value = "";
}

function executeQuery() {
    const query = document.getElementById("sql-query").textContent.trim();
    const resultMessage = document.getElementById("result-message");
    const resultTable = document.getElementById("query-result");
    
    // Clear previous results and result messages
    resultTable.innerHTML = ""; // Clear previous results
    resultMessage.textContent = ""; // Reset result message to be empty

    // Clear any previous record messages
    const existingRecordMessage = document.getElementById("record-message");
    if (existingRecordMessage) {
        existingRecordMessage.innerHTML = ""; // Clear previous record count message
    }

    try {
        // Execute the query
        const result = db.exec(query);

        // Check if the result array is empty
        if (!result || result.length === 0 || !result[0].values || result[0].values.length === 0) {
            resultMessage.textContent = "No results found for the query.";
            return;
        }

        // Calculate and display the number of records found
        const numRecords = result[0].values.length;
        const recordMessage = document.createElement("p");
        recordMessage.id = "record-message"; // Set an ID to reference later
        recordMessage.textContent = `Found ${numRecords} record(s):`;
        resultTable.parentNode.insertBefore(recordMessage, resultTable);

        const headers = result[0].columns;
        const headerRow = resultTable.insertRow();
        headers.forEach(header => {
            const cell = headerRow.insertCell();
            cell.textContent = header;
            cell.style.fontWeight = "bold";
        });

        result[0].values.forEach(row => {
            const rowElement = resultTable.insertRow();
            row.forEach(cellData => {
                const cell = rowElement.insertCell();
                cell.textContent = cellData;
            });
        });

        // Clear any previous messages after displaying results
        resultMessage.textContent = ""; 
        scrollToQResults(); // Scroll to results after successful execution
    } catch (e) {
        // Display an error message
        resultMessage.textContent = `Error executing query: ${e.message}`;
    }
}



function openTab(evt, tabName) {
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove("active");
    }

    const tabButtons = document.querySelectorAll(".tab button");
    tabButtons.forEach(button => button.classList.remove("active"));

    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}


function populateTableButtons() {
    const tablesContainer= document.getElementById("table-buttons");
    tablesContainer.innerHTML = "";

    let tnames;
    switch (currentDatabase) {
        case "people":
            tnames= ["people"];
            break;
        case "cars":
            tnames= ["cars"];
            break;
        case "products":
            tnames= ["products"];
            break;
    }

    tnames.forEach(tname => {
        const button = document.createElement("button");
        button.textContent = tname;
        button.onclick = () => appendSQL(tname);
        tablesContainer.appendChild(button);
    });
}

function scrollToQResults() {
  const qResultsElement = document.getElementById("qresults");
  if (qResultsElement) {
    qResultsElement.scrollIntoView({ behavior: "smooth" });
  }
}

function toggleTable() {
    const tableContainer = document.querySelector('.table-container');
    const toggleButton = document.getElementById('toggle-table-button');

    if (tableContainer.style.display === "none") {
        tableContainer.style.display = "block";
        toggleButton.textContent = "Hide Table";
    } else {
        tableContainer.style.display = "none";
        toggleButton.textContent = "Show Table";
    }
}

// List of challenges with the required SQL commands to solve each
const challenges = [
    {
        question: "1. Select all records from the 'people' table.",
        correctQuery: "SELECT * FROM people"
    },
    {
        question: "2. Retrieve all records from the 'cars' table where the fuel_type is 'Petrol'.",
        correctQuery: "SELECT * FROM cars WHERE fuel_type = 'Petrol'"
    },
    {
        question: "3. Show the 'surname' and 'forename' of people born in 2008.",
        correctQuery: "SELECT surname, forename FROM people WHERE year_of_birth = 2008"
    },
    {
        question: "4. Find all products in the 'Kitchen Appliances' category.",
        correctQuery: "SELECT * FROM products WHERE category = 'Kitchen Appliances'"
    },
    {
        question: "5. Get all car models owned by 'James Turner'.",
        correctQuery: "SELECT model FROM cars WHERE owner_name = 'James Turner'"
    },
    {
        question: "6. List all 'products' that have more than 20 items in stock.",
        correctQuery: "SELECT * FROM products WHERE number_in_stock > 20"
    },
    {
        question: "7. Select all 'surname' and 'height' from the 'people' table where the height is greater than 100.",
        correctQuery: "SELECT surname, height FROM people WHERE height > 100"
    },
    {
        question: "8. Find 'make' and 'model' of cars in the 'Hatchback' body style.",
        correctQuery: "SELECT make, model FROM cars WHERE body_style = 'Hatchback'"
    },
    {
        question: "9. Retrieve all records from 'products' sorted by price in descending order.",
        correctQuery: "SELECT * FROM products ORDER BY price DESC"
    },
    {
        question: "10. Get the 'forename' and 'eye_color' of all people born in 'May'.",
        correctQuery: "SELECT forename, eye_color FROM people WHERE month_of_birth = 'May'"
    }
];

let currentChallengeIndex = 0;

function loadChallenge() {
    const challengeContainer = document.getElementById("challenge-container");
    challengeContainer.textContent = challenges[currentChallengeIndex].question;
}

function checkChallenge() {
    const userQuery = document.getElementById("sql-query").textContent.trim();
    const resultMessage = document.getElementById("challenge-result");

    // Display the user's entered query and whether it is correct or incorrect
    if (userQuery.toLowerCase() === challenges[currentChallengeIndex].correctQuery.toLowerCase()) {
        resultMessage.innerHTML = `
            <p>Your query: <code>${userQuery}</code></p>
            <p style="color: green;">Correct! Moving to the next challenge.</p>
        `;

        // Move to the next challenge after a delay
        setTimeout(() => {
            currentChallengeIndex++;
            if (currentChallengeIndex < challenges.length) {
                loadChallenge();
                clearQuery();
                resultMessage.textContent = ""; // Clear result message
            } else {
                resultMessage.textContent = "Congratulations! You have completed all the challenges!";
            }
        }, 2000);
    } else {
        resultMessage.innerHTML = `
            <p>Your query: <code>${userQuery}</code></p>
            <p style="color: red;">Incorrect query. Please try again.</p>
        `;
    }
}


document.addEventListener("DOMContentLoaded", () => {
    // Create and load the first challenge when the page loads
    const challengeSection = document.createElement("div");
    challengeSection.id = "challenge-section";
    challengeSection.style.marginTop = "20px";
    challengeSection.innerHTML = `
        <h2>SQL Challenge</h2>
        <p id="challenge-container"></p>
        <button class="run-query-button" onclick="checkChallenge()">
            Submit Challenge Answer
        </button>
        <p id="challenge-result"></p>
    `;
    document.querySelector(".container").appendChild(challengeSection);

    // Load the first challenge
    loadChallenge();
});




