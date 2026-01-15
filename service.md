---
layout: page
title: Service
permalink: /service/
---

{% for item in site.data.service %}
<div class="card">
    <h3>{{ item.organization }}</h3>
    {% if item.role %}<p><strong>Role:</strong> {{ item.role }}</p>{% endif %}
    <p>{{ item.description }}</p>

    {% if item.link %}
    <p><a href="{{ item.link }}" target="_blank">{{ item.link_text }}</a></p>
    {% endif %}

    {% if item.images %}
    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
        {% for img in item.images %}
        <div style="flex:1; min-width: 200px;">
             <!-- Placeholder logic for missing images -->
            <img src="{{ img.src | relative_url }}" alt="{{ img.alt }}" style="width:100%; border:1px solid #ddd;" onerror="this.style.display='none'; this.parentElement.innerHTML='<small><i>Image pending: '+this.alt+'</i></small>'">
        </div>
        {% endfor %}
    </div>
    {% endif %}
</div>
{% endfor %}
