---
layout: page
title: Videos
permalink: /videos/
---

<p>Videos explaining topics of interest and subtopics in radiation therapy.</p>

{% for video in site.data.videos %}
<div class="card">
    <h3>{{ video.title }}</h3>
    <p>{{ video.description }}</p>
    {% if video.youtube_id and video.youtube_id != "PLACEHOLDER_ID" %}
    <div class="video-container">
        <iframe src="https://www.youtube.com/embed/{{ video.youtube_id }}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>
    {% else %}
    <div style="background:#eee; padding:2rem; text-align:center;">
        <p><em>Video coming soon...</em></p>
    </div>
    {% endif %}
</div>
{% endfor %}
