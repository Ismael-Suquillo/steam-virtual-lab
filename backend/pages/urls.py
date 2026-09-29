from django.urls import path
from .views import dashboard_view, science_module_view

urlpatterns = [
    path('', dashboard_view, name='dashboard'),
    path('modulo/ciencia/', science_module_view, name='science_module'),
]