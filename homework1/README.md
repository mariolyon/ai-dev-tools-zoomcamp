## Todo App

A simple Django todo application.

### Setup

```bash
# Install uv (if not already installed)
brew install uv

# Create and activate virtual environment
uv venv .venv
source .venv/bin/activate

# Install dependencies
uv pip install django
```

### Run the app

```bash
cd homework1
python manage.py migrate
python manage.py runserver
```

Then visit http://127.0.0.1:8000/todos/

### Admin panel

Create a superuser to access the Django admin:

```bash
cd homework1
python manage.py createsuperuser
```

Follow the prompts to set a username, email, and password.

Then visit http://127.0.0.1:8000/admin/ and log in with your superuser credentials to manage todos.

### Run tests

```bash
cd homework1
python manage.py test
```
