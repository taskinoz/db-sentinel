# DB Sentinel

DB Sentinel is a lightweight, containerized database backup management tool. It supports PostgreSQL and MySQL databases, runs daily backups, and provides a web interface to view backup stats and manage databases. Backups are stored in a mounted folder for easy access.

## Features
- **Daily Automated Backups:** Schedule backups for all your databases.
- **Web Interface:** View database stats, last backup time, and total backup size. Add new databases via a simple form.
- **Persistent Storage:** Backups are saved to a mounted folder for safe access outside the container.
- **PostgreSQL and MySQL Support:** Compatible with the two most popular database systems.
- **Containerized Deployment:** Easy setup and consistent runtime using Docker.

## Requirements
Docker and Docker Compose installed on your system.

## Installation and Setup
1. Clone the repository:
```bash
git clone https://github.com/taskinoz/db-sentinel.git
cd db-sentinel
```
2. Create the Backup Folder:
Create a folder on your host machine to store backups:
```bash
mkdir dumps
```
3. Build and Run the Application
Use `docker-compose` to build and start the container:
```bash
docker-compose up -d
```

## Usage
### Access the Web Interface
1. Open your browser and navigate to: [http://localhost:3000](http://localhost:3000)
2. Use the web interface to:
    - View database stats (name, last backup time, total size).
    - Add new databases to the backup schedule.
### Add Databases
1. Click the "Add New Database" button on the homepage.
2. Fill out the form with the database credentials:
    - Name
    - Type (PostgreSQL or MySQL)
    - Host
    - Port
    - Username
    - Password
    - Database name
3. Save your changes.
### Backups
Backups run daily at 2:00 AM (server time) and are stored in the `dumps/` folder on your host machine.

## Stopping the Application
To stop the application, run:
```bash
docker-compose down
```

## Accessing Backups
All backups are saved to the `dumps/` folder on your host machine. Files are named in the format:
```
<database_name>_<YYYYMMDD_HHMMSS>.sql
```

## Troubleshooting
### Logs
To view application logs, run:
```bash
docker-compose logs -f
```
### Backup Errors
Ensure the databases are accessible from the Docker container's network and credentials are correct. Test connectivity manually if issues persist.

## Contributing
Contributions are welcome! Feel free to submit issues or pull requests to enhance DB Sentinel.

## License
This project is licensed under the MIT License. See the LICENSE file for details.
