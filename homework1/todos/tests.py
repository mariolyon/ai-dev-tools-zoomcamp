from django.test import TestCase, Client
from django.urls import reverse
from .models import Todo


class TodoModelTests(TestCase):
    """Tests for the Todo model."""

    def test_todo_creation_defaults(self):
        """New todo has completed=False and created_at set."""
        todo = Todo.objects.create(title="Test todo")
        self.assertEqual(todo.title, "Test todo")
        self.assertFalse(todo.completed)
        self.assertIsNotNone(todo.created_at)

    def test_todo_str(self):
        """__str__ returns the title."""
        todo = Todo.objects.create(title="My task")
        self.assertEqual(str(todo), "My task")


class TodoListViewTests(TestCase):
    """Tests for the todo_list view."""

    def test_empty_list(self):
        """GET /todos/ returns 200 with empty message."""
        response = self.client.get(reverse('todo_list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "No todos yet")

    def test_list_with_todos(self):
        """GET /todos/ returns 200 and displays todos."""
        Todo.objects.create(title="First todo")
        Todo.objects.create(title="Second todo")
        response = self.client.get(reverse('todo_list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "First todo")
        self.assertContains(response, "Second todo")

    def test_list_order(self):
        """Todos are ordered by newest first."""
        todo1 = Todo.objects.create(title="First")
        todo2 = Todo.objects.create(title="Second")
        response = self.client.get(reverse('todo_list'))
        todos = list(response.context['todos'])
        self.assertEqual(todos[0], todo2)
        self.assertEqual(todos[1], todo1)


class TodoDetailViewTests(TestCase):
    """Tests for the todo_detail view."""

    def test_valid_todo(self):
        """GET /todos/<id>/ returns 200 for existing todo."""
        todo = Todo.objects.create(title="Test todo")
        response = self.client.get(reverse('todo_detail', args=[todo.id]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Test todo")

    def test_invalid_todo(self):
        """GET /todos/<id>/ returns 404 for non-existent todo."""
        response = self.client.get(reverse('todo_detail', args=[999]))
        self.assertEqual(response.status_code, 404)


class AddTodoViewTests(TestCase):
    """Tests for the add_todo view."""

    def test_add_todo(self):
        """POST creates todo and returns 201 with JSON."""
        response = self.client.post(reverse('add_todo'), {'title': 'New todo'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Todo.objects.count(), 1)
        todo = Todo.objects.first()
        self.assertEqual(todo.title, 'New todo')
        # Check JSON response
        data = response.json()
        self.assertEqual(data['title'], 'New todo')
        self.assertEqual(data['id'], todo.id)
        self.assertFalse(data['completed'])

    def test_add_empty_title(self):
        """POST with empty title returns 400 and doesn't create todo."""
        response = self.client.post(reverse('add_todo'), {'title': ''})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Todo.objects.count(), 0)

    def test_add_whitespace_title(self):
        """POST with whitespace-only title returns 400."""
        response = self.client.post(reverse('add_todo'), {'title': '   '})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Todo.objects.count(), 0)

    def test_get_method_not_allowed(self):
        """GET request returns 405."""
        response = self.client.get(reverse('add_todo'))
        self.assertEqual(response.status_code, 405)


class ToggleTodoViewTests(TestCase):
    """Tests for the toggle_todo view."""

    def test_toggle_incomplete_to_complete(self):
        """Toggle changes completed from False to True."""
        todo = Todo.objects.create(title="Test", completed=False)
        response = self.client.post(reverse('toggle_todo', args=[todo.id]))
        self.assertEqual(response.status_code, 302)
        todo.refresh_from_db()
        self.assertTrue(todo.completed)

    def test_toggle_complete_to_incomplete(self):
        """Toggle changes completed from True to False."""
        todo = Todo.objects.create(title="Test", completed=True)
        response = self.client.post(reverse('toggle_todo', args=[todo.id]))
        self.assertEqual(response.status_code, 302)
        todo.refresh_from_db()
        self.assertFalse(todo.completed)

    def test_toggle_nonexistent(self):
        """Toggle non-existent todo returns 404."""
        response = self.client.post(reverse('toggle_todo', args=[999]))
        self.assertEqual(response.status_code, 404)


class DeleteTodoViewTests(TestCase):
    """Tests for the delete_todo view."""

    def test_delete_existing(self):
        """Delete removes todo and redirects."""
        todo = Todo.objects.create(title="Test")
        response = self.client.post(reverse('delete_todo', args=[todo.id]))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Todo.objects.count(), 0)

    def test_delete_nonexistent(self):
        """Delete non-existent todo returns 404."""
        response = self.client.post(reverse('delete_todo', args=[999]))
        self.assertEqual(response.status_code, 404)
