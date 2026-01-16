---
layout: page
title: Presentations
permalink: /presentations/
---

### Conference Presentations

<ol>
{% for pres in site.data.presentations.conference %}
    <li>
        <strong>{{ pres.authors }}</strong>, “{{ pres.title }}", {{ pres.event }}, {{ pres.location }}, {{ pres.date }}.
        {% if pres.note %}<br/><em>{{ pres.note }}</em>{% endif %}
        {% if pres.award %}<br/><strong>{{ pres.award }}</strong>{% endif %}
    </li>
{% endfor %}
</ol>

### Poster Presentations

<ol>
{% for poster in site.data.presentations.posters %}
<li>
    <strong>“{{ poster.title }}"</strong>
    {{ poster.authors }}
    {{ poster.event }}, {{ poster.location }}, {{ poster.date }}.
</li>
{% endfor %}
</ol>

### Competitions

{% for comp in site.data.presentations.competitions %}
<div class="card">
    <h3>{{ comp.event }} ({{ comp.year }})</h3>
    {% if comp.title %}<p class="comp-title">{{ comp.title }}</p>{% endif %}
    {% if comp.location %}<p>{{ comp.location }}</p>{% endif %}
    <!-- {% if comp.link %}<p><a href="{{ comp.link }}" target="_blank">{{ comp.link_text }}</a></p>{% endif %} -->
    {% if comp.award %}<p class="comp-award"><em>{{ comp.award }}</em></p>{% endif %}
    {% if comp.youtube_id %}
    <br>Watch it here!
    <div class="video-container">
    <iframe src="https://www.youtube.com/embed/{{ comp.youtube_id }}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>
    {% endif %}
</div>
{% endfor %}



