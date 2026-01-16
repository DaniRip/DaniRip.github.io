---
layout: page
title: Teaching & Mentorship
permalink: /teaching/
---

### Teaching Experience <i class="fas fa-chalkboard-user"></i>

{% for job in site.data.teaching.teaching_experience %}
<div class="card">
    <h3>{{ job.course }}</h3>
    <p><strong>{{ job.year }}</strong> | {{ job.role }}</p>
    {% if job.details %}<p>{{ job.details }}</p>{% endif %}
</div>
{% endfor %}

### Teaching Assistant Experience <i class="fas fa-pen-nib"></i>

<ul>
{% for job in site.data.teaching.ta_experience %}
    <li>
        <strong>{{ job.course }}</strong> ({{ job.years | default: job.year }})
        {% if job.details %} {{ job.details }} {% endif %}
    </li>
{% endfor %}
</ul>

### Distinctions <i class="fas fa-award"></i>

{% for item in site.data.teaching.distinctions %}
<div class="card">
    <h3>{{ item.title }}</h3>
    <p>{{ item.description }}</p>
</div>
{% endfor %}

### Mentorship <i class="fas fa-seedling"></i>

I was lucky enough to mentor some undergraduate students throughout my time at the University of Waterloo.

<ul>
{% for mentee in site.data.mentorship %}
    <li>
        <strong>{{ mentee.student }}</strong> ({{ mentee.year }}): {{ mentee.project }}.
    </li>
{% endfor %}
</ul>
