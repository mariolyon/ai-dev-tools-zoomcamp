from django.shortcuts import render, redirect, get_object_or_404
from .models import Todo


def todo_list(request):
    todos = Todo.objects.all().order_by('-created_at')
    return render(request, 'todos/home.html', {'todos': todos})


def add_todo(request):
    if request.method == 'POST':
        title = request.POST.get('title')
        if title:
            Todo.objects.create(title=title)
    return redirect('todo_list')


def toggle_todo(request, todo_id):
    todo = get_object_or_404(Todo, id=todo_id)
    todo.completed = not todo.completed
    todo.save()
    return redirect('todo_list')


def delete_todo(request, todo_id):
    todo = get_object_or_404(Todo, id=todo_id)
    todo.delete()
    return redirect('todo_list')


def todo_detail(request, todo_id):
    todo = get_object_or_404(Todo, id=todo_id)
    return render(request, 'todos/detail.html', {'todo': todo})
