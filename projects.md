---
layout: page
title: Projects
permalink: /projects/
---

<div class="project-tabs">
    <button class="tab-btn active" onclick="openCategory('active')">Active Research</button>
    <button class="tab-btn" onclick="openCategory('completed')">Completed</button>
    <button class="tab-btn" onclick="openCategory('fun')">Old / Just for Fun</button>
    <button class="tab-btn" onclick="openCategory('future')">Future Ambitions</button>
</div>

<div class="projects-display-area">
    {% assign categories = "active,completed,fun,future" | split: "," %}
    
    {% for cat in categories %}
    <div id="{{ cat }}" class="category-container" style="display: {% if cat == 'active' %}block{% else %}none{% endif %};">
        
        <button class="nav-arrow left" onclick="changeSlide(-1, '{{ cat }}')"><i class="fas fa-chevron-left"></i></button>
        <button class="nav-arrow right" onclick="changeSlide(1, '{{ cat }}')"><i class="fas fa-chevron-right"></i></button>

        <div class="slides-wrapper">
            {% assign cat_projects = site.data.projects | where: "category", cat %}
            
            {% if cat_projects.size > 0 %}
                {% for project in cat_projects %}
                <div class="project-slide fade {% if forloop.first %}visible{% endif %}">
                    
                    <h2 class="slide-title">{{ project.title }}</h2>
                    
                    {% assign has_media = false %}
                    {% if project.gallery or project.video_id or project.image %}
                        {% assign has_media = true %}
                    {% endif %}
                    
                    <div class="slide-content {% unless has_media %}no-media-layout{% endunless %}">
                        
                        {% if has_media %}
                        <div class="slide-visual">
                            {% assign project_uid = cat | append: "-" | append: forloop.index %}
                            
                            <div id="display-{{ project_uid }}" class="visual-stack">
                                {% if project.gallery %}
                                    {% for item in project.gallery %}
                                        <div class="media-item {% if forloop.first %}active{% endif %}" data-index="{{ forloop.index0 }}">
                                            {% if item.type == 'video' %}
                                                <div class="video-container">
                                                    <iframe src="https://www.youtube.com/embed/{{ item.id }}" frameborder="0" allowfullscreen></iframe>
                                                </div>
                                            {% else %}
                                                <img src="{{ item.url | relative_url }}" alt="Project Visual" class="slide-img">
                                            {% endif %}
                                        </div>
