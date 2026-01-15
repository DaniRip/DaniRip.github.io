---
layout: page
title: Projects
permalink: /projects/
---

## Active Research Topics

{% for project in site.data.projects.research %}
<div class="card">
    <h3>{{ project.title }}</h3>
    <p>{{ project.description }}</p>
    {% if project.link %}
    <p><a href="{{ project.link }}" target="_blank">Learn More</a></p>
    {% endif %}
    {% if project.image %}
    <img src="{{ project.image | relative_url }}" alt="{{ project.title }}" style="max-width: 100%; border-radius: 8px; margin-top: 10px;">
    {% endif %}
</div>
{% endfor %}

## Just for Fun

{% for project in site.data.projects.fun %}
<div class="card">
    <h3>{{ project.title }}</h3>
    <p>{{ project.description }}</p>
    {% if project.link %}
    <p><a href="{{ project.link }}" target="_blank">Check it out</a></p>
    {% endif %}
    {% if project.image %}
    <img src="{{ project.image | relative_url }}" alt="{{ project.title }}" style="max-width: 100%; border-radius: 8px; margin-top: 10px;">
    {% endif %}
</div>
{% endfor %}
