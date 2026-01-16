---
layout: page
title: Presentations
permalink: /presentations/
---

### Conference Presentations

<ol>
{% for pres in site.data.presentations.conference %}
    <li>
        <strong>{{ pres.authors | replace: "D. A. Ripsman", "<u>D. A. Ripsman</u>" | replace: "D. Ripsman", "<u>D. Ripsman</u>" }}</strong>, “{{ pres.title }}", {{ pres.event }}, {{ pres.location }}, {{ pres.date }}.
        {% if pres.note %}<br/><em>{{ pres.note }}</em>{% endif %}
        {% if pres.award %}<br/><strong>{{ pres.award }}</strong>{% endif %}
    </li>
{% endfor %}
</ol>

### Poster Presentations

<ol>
{% for poster in site.data.presentations.posters %}
<li>
    <i class="far fa-file-image"></i> <strong>“{{ poster.title }}”</strong><br>
    <small>{{ poster.authors }}</small><br>
    <span class="event-details">{{ poster.event }} — {{ poster.location }} ({{ poster.date }})</span>
</li>
{% endfor %}
</ol>

### Competitions

{% for comp in site.data.presentations.competitions %}
<div class="card">
    <h3>{{ comp.event }} ({{ comp.year }})</h3>
    {% if comp.title %}<p class="comp-title">{{ comp.title }}</p>{% endif %}
    {% if comp.authors %}<p>{{ comp.authors }}</p>{% endif %}
    {% if comp.location %}<p>{{ comp.location }}</p>{% endif %}
    <!-- {% if comp.link %}<p><a href="{{ comp.link }}" target="_blank">{{ comp.link_text }}</a></p>{% endif %} -->
    {% if comp.award %}
        <p class="comp-award">
            <i class="fas fa-trophy"></i> {{ comp.award }}
        </p>
    {% endif %}
    
    {% if comp.youtube_id %}
        <a href="https://www.youtube.com/watch?v={{ comp.youtube_id }}" class="video-btn" target="_blank">
            <i class="fab fa-youtube"></i> Watch Presentation
        </a>
    {% endif %}
</div>
{% endfor %}



