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

### Poster Presentations <i class="far fa-file-image"></i>

<ol>
{% for poster in site.data.presentations.posters %}
<li>
    <strong>“{{ poster.title }}”</strong><br>
    <small>{{ poster.authors }}</small><br>
    <span class="event-details">{{ poster.event }} — {{ poster.location }} ({{ poster.date }})</span>
</li>
{% endfor %}
</ol>

### Competitions <i class="fas fa-trophy"></i>

{% for comp in site.data.presentations.competitions %}
<div class="card">
    <details>
        <summary style="list-style: none; cursor: pointer;">
            <div class="card-header">
                <h3>
                    {{ comp.event }} ({{ comp.year }}) 
                    <i class="fas fa-chevron-down toggle-chevron" style="font-size: 0.8em; margin-left: 8px; color: #4ca1af;"></i>
                </h3>
                {% if comp.award %}
                    <span class="award-badge-small"><i class="fas fa-trophy"></i> {{ comp.award }}</span>
                {% endif %}
            </div>
        </summary>

        <div style="margin-top: 15px;">
            {% if comp.title %}<p class="comp-title">“{{ comp.title }}”</p>{% endif %}
            
            <p class="comp-meta">
                {% if comp.authors %}<span><i class="fas fa-users"></i> {{ comp.authors }}</span><br>{% endif %}
                {% if comp.location %}<span><i class="fas fa-map-marker-alt"></i> {{ comp.location }}</span>{% endif %}
            </p>

            {% if comp.youtube_id %}
            <div class="video-section">
                <p class="video-label"><i class="fab fa-youtube"></i> Featured Presentation:</p>
                <div class="video-container">
                    <iframe src="https://www.youtube.com/embed/{{ comp.youtube_id }}" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                    </iframe>
                </div>
            </div>
            {% endif %}
        </div>
    </details>
</div>
{% endfor %}



