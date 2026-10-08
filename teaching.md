---
layout: page
title: Teaching & Mentorship
permalink: /teaching/
---

### Teaching Experience <i class="fas fa-chalkboard-user"></i>

{% for job in site.data.teaching.teaching_experience %}
<div class="teaching-minimal">
    <p>
        <strong>{{ job.course }}</strong> ({{ job.year }}), <em>{{ job.role }}</em>
        {% if job.details %}<br><small>{{ job.details }}</small>{% endif %}
    </p>
</div>
{% endfor %}

### Teaching Assistant Experience <i class="fas fa-pen-nib"></i>

<div class="ta-grid">
{% for job in site.data.teaching.ta_experience %}
    <div class="ta-item">
        <strong>{{ job.course }}</strong>
        
        <span class="ta-year-inline">({{ job.years | default: job.year }})</span>

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

### Teaching Materials <i class="fas fa-book-open"></i>

<div class="card teaching-material">
    <a href="{{ "/talks/walking-the-corners/" | relative_url }}" target="_blank">
        <img src="{{ "/assets/walking-the-corners.jpg" | relative_url }}" alt="Title slide of Walking the Corners" loading="lazy">
    </a>
    <div>
        <h3>Walking the Corners: The Simplex Method, Duality, and the Art of Choosing a Pivot</h3>
        <p>An interactive, undergraduate-level lecture made for the Optimal Lab at Johns Hopkins (2026). Starting from a small bakery problem, it builds the geometry of linear programming, derives the dual as a game of bounding the profit, works through the simplex tableau, lifts the problem into 3D, and races four pivot rules against each other, including on the Klee–Minty cube. It closes with a research question: can a policy learn to pick pivots?</p>
        <div class="material-links">
            <a href="{{ "/talks/walking-the-corners/" | relative_url }}" target="_blank" class="pub-link-btn"><i class="fas fa-play"></i> Open the slides</a>
            <a href="{{ "/talks/walking-the-corners/walking-the-corners.pdf" | relative_url }}" target="_blank" class="pub-link-btn"><i class="far fa-file-pdf"></i> PDF version</a>
        </div>
        <small>Step through with the arrow keys or a clicker; press <strong>f</strong> for fullscreen.</small>
    </div>
</div>

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
