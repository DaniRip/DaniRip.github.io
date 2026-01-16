---
layout: page
title: Service
permalink: /service/
---

{% for item in site.data.service %}
<div class="service-entry">
    <div class="service-header">
        <h3 class="service-org">{{ item.organization }}</h3>
        <span class="service-role">{{ item.role }}</span>
    </div>
    <p class="service-desc">{{ item.description }}</p>
    
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
