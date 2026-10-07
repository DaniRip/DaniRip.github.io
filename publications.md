---
layout: page
title: Publications
permalink: /publications/
---

<p><em>Also see my <a href="https://scholar.google.com/citations?hl=en&user=29TV-goAAAAJ&view_op=list_works&sortby=pubdate" target="_blank">Google Scholar profile</a> for an updated list.</em></p>

{% comment %} Each entry in _data/publications.yml has a status that puts it in one of these sections {% endcomment %}
{% assign sections = "published|Journal Articles,under_review|Under Review,working|Working Papers" | split: "," %}

{% for section in sections %}
{% assign parts = section | split: "|" %}
{% assign pubs = site.data.publications | where: "status", parts[0] %}
{% if pubs.size > 0 %}

### {{ parts[1] }}

{% for pub in pubs %}
<div class="publication-item card">
    <div class="pub-content">
        <div class="publication-title">{{ pub.title }}</div>
        <div class="pub-authors">{{ pub.authors | replace: "D. A. Ripsman", "<strong>D. A. Ripsman</strong>" | replace: "D. Ripsman", "<strong>D. Ripsman</strong>" }}</div>
        {% if pub.journal %}
        <div class="pub-venue"><em>{{ pub.journal }}</em>, {{ pub.volume }}, {{ pub.year }}.</div>
        {% elsif pub.note %}
        <div class="pub-venue">{{ pub.note }}</div>
        {% endif %}
    </div>
    
    <div class="pub-links">
        {% if pub.link %}
            <a href="{{ pub.link }}" target="_blank" class="pub-link-btn">
                <i class="fas fa-external-link-alt"></i> Link
            </a>
        {% endif %}
        </div>
</div>
{% endfor %}

{% endif %}
{% endfor %}
