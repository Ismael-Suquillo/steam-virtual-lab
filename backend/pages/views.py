from django.shortcuts import render


def dashboard_view(request):
    context = {
        "title": "STEAM Virtual Lab",
        "modules": [
            {
                "code": "S",
                "name": "Ciencia",
                "icon": "🔬",
                "color": "#3A86FF",
                "description": "Laboratorio de reacciones y simuladores espaciales.",
                "tag": "Simulador 2D",
            },
            {
                "code": "T",
                "name": "Tecnología",
                "icon": "💻",
                "color": "#8338EC",
                "description": "Editor de código en vivo y lógica de programación.",
                "tag": "Código",
            },
            {
                "code": "E",
                "name": "Ingeniería",
                "icon": "🏗️",
                "color": "#FF006E",
                "description": "Prueba de resistencia de puentes y circuitos.",
                "tag": "Física",
            },
            {
                "code": "A",
                "name": "Arte",
                "icon": "🎨",
                "color": "#FB5607",
                "description": "Pixel Art Creator y estudio de audio digital.",
                "tag": "Creativo",
            },
            {
                "code": "M",
                "name": "Matemáticas",
                "icon": "📐",
                "color": "#FFBE0B",
                "description": "Geometría interactiva y retos lógicos.",
                "tag": "Lógica",
            },
        ],
    }

    return render(request, 'dashboard.html', context)


# Create your views here.
