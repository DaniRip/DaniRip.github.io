---
layout: page
title: Presentations
permalink: /presentations/
---

## Conference Presentations

<ol>
{% for pres in site.data.presentations.conference %}
    <li>
        <strong>{{ pres.authors }}</strong>, “{{ pres.title }}", {{ pres.event }}, {{ pres.location }}, {{ pres.date }}.
        {% if pres.note %}<br/><em>{{ pres.note }}</em>{% endif %}
        {% if pres.award %}<br/><strong>{{ pres.award }}</strong>{% endif %}
    </li>
{% endfor %}
</ol>

## Competitions

{% for comp in site.data.presentations.competitions %}
<div class="card">
    <h3>{{ comp.title }} ({{ comp.year }})</h3>
    {% if comp.location %}<p>{{ comp.location }}</p>{% endif %}
    {% if comp.link %}<p><a href="{{ comp.link }}" target="_blank">{{ comp.link_text }}</a></p>{% endif %}
    {% if comp.award %}<p><strong>{{ comp.award }}</strong></p>{% endif %}
</div>
{% endfor %}

## Poster Presentations

{% for poster in site.data.presentations.posters %}
<div class="publication-item">
    <div class="publication-title">{{ poster.title }}</div>
    <div>{{ poster.authors }}</div>
    <div>{{ poster.event }}, {{ poster.location }}, {{ poster.date }}.</div>
</div>
{% endfor %}
