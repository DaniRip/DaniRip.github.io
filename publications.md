---
layout: page
title: Publications
permalink: /publications/
---

<p><em>Also see my <a href="https://scholar.google.com/citations?hl=en&user=29TV-goAAAAJ&view_op=list_works&sortby=pubdate" target="_blank">Google Scholar profile</a> for an updated list.</em></p>

{% for pub in site.data.publications %}
<div class="publication-item">
    <div class="publication-title">{{ pub.title }}</div>
    <div>{{ pub.authors }}</div>
    <div><em>{{ pub.journal }}</em>, {{ pub.volume }}, {{ pub.year }}.</div>
    {% if pub.link %}
    <a href="{{ pub.link }}" target="_blank">[Link]</a>
    {% endif %}
</div>
{% endfor %}
