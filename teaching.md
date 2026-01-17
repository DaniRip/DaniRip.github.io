---
layout: page
title: Teaching & Mentorship
permalink: /teaching/
---

### Teaching Experience <i class="fas fa-chalkboard-user"></i>

{% for job in site.data.teaching.teaching_experience %}
<div class="teaching-minimal">
    <p>
        <strong>{{ job.course }}</strong> ({{ job.year }}) — <em>{{ job.role }}</em>
        {% if job.details %}<br><small>{{ job.details }}</small>{% endif %}
    </p>
</div>
{% endfor %}

### Teaching Assistant Experience <i class="fas fa-pen-nib"></i>

<div class="ta-grid">
{% for job in site.data.teaching.ta_experience %}
    <div class="ta-item">
        <strong>{{ job.course }}</strong>
        
        {% assign year_string = job.years | default: job.year %}
        {% assign year_size = year_string | size %}
        
        {% if year_size > 9 %}
            <div class="ta-year-block">({{ year_string }})</div>
        {% else %}
            <span class="ta-year-inline">({{ year_string }})</span>
        {% endif %}

        {% if job.details %}
            <div class="ta-details">{{ job.details }}</div>
        {% endif %}
    </div>
{% endfor %}
</div>

### Distinctions <i class="fas fa-award"></i>

{% for item in site.data.teaching.distinctions %}
<div class="award-card card">
    <div class="card-header">
        <h3>{{ item.title }}</h3>
    </div>
    <p>{{ item.description }}</p>
</div>
{% endfor %}

### Mentorship <i class="fas fa-seedling"></i>

<p class="mentorship-intro">During my time at the University of Waterloo, I had the privilege of mentoring undergraduate researchers on various optimization and healthcare projects.</p>

<div class="mentorship-container">
    {% for mentee in site.data.mentorship %}
    <div class="mentee-item">
        <div class="mentee-header">
            <strong>{{ mentee.student }}</strong>
            <span class="mentee-year">{{ mentee.year }}</span>
        </div>
        <p class="mentee-project"><em>Project:</em> {{ mentee.project }}</p>
    </div>
    {% endfor %}
</div>
