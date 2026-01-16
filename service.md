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
<div class="project-gallery-icons">
    {% for img in item.images %}
    <a href="{{ img.src | relative_url }}" data-lightbox="project-{{ item.organization | slugify }}" data-title="{{ img.alt }}">
        <img src="{{ img.src | relative_url }}" alt="{{ img.alt }}" class="thumbnail-icon">
    </a>
    {% endfor %}
</div>
{% endif %}
</div>
{% endfor %}
