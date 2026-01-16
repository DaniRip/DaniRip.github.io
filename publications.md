---
layout: page
title: Publications
permalink: /publications/
---

<p><em>Also see my <a href="https://scholar.google.com/citations?hl=en&user=29TV-goAAAAJ&view_op=list_works&sortby=pubdate" target="_blank">Google Scholar profile</a> for an updated list.</em></p>

<!-- {% for pub in site.data.publications %}
<div class="publication-item">
    <div class="publication-title">{{ pub.title }}</div>
    <div>{{ pub.authors }}</div>
    <div><em>{{ pub.journal }}</em>, {{ pub.volume }}, {{ pub.year }}.</div>
    {% if pub.link %}
    <a href="{{ pub.link }}" target="_blank">[Link]</a>
    {% endif %}
</div>
{% endfor %} -->

{% for pub in site.data.publications %}
<div class="publication-item {% if pub.featured %}featured-pub{% endif %}">
    <div class="pub-main">
        <div class="publication-title">{{ pub.title }}</div>
        <div class="pub-authors">{{ pub.authors | replace: "D. Ripsman", "<strong>D. Ripsman</strong>" }}</div>
        <div class="pub-venue"><em>{{ pub.journal }}</em>, {{ pub.year }}.</div>
    </div>
    <div class="pub-links">
        {% if pub.link %}<a href="{{ pub.link }}" class="pub-btn">[DOI]</a>{% endif %}
        {% if pub.pdf %}<a href="{{ pub.pdf }}" class="pub-btn">[PDF]</a>{% endif %}
    </div>
</div>
{% endfor %}
