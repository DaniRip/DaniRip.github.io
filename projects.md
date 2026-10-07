---
layout: page
title: Projects
permalink: /projects/
---

<div class="project-tabs">
    <button class="tab-btn active" onclick="openCategory('active', this)">Active Research</button>
    <button class="tab-btn" onclick="openCategory('completed', this)">Completed</button>
    <button class="tab-btn" onclick="openCategory('fun', this)">Old / Just for Fun</button>
    <button class="tab-btn" onclick="openCategory('future', this)">Future Ambitions</button>
</div>

<div class="projects-display-area">
    {% assign categories = "active,completed,fun,future" | split: "," %}
    
    {% for cat in categories %}
    <div id="{{ cat }}" class="category-container" style="display: {% if cat == 'active' %}block{% else %}none{% endif %};">


        <div class="slides-wrapper">
            {% assign cat_projects = site.data.projects | where: "category", cat %}
            
            {% if cat_projects.size > 0 %}
                {% for project in cat_projects %}
                <div class="project-slide">
                    
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
                                                    <iframe src="https://www.youtube.com/embed/{{ item.id }}" frameborder="0" loading="lazy" allowfullscreen></iframe>
                                                </div>
                                            {% else %}
                                                <img src="{{ item.url | relative_url }}" alt="{{ project.title | escape }}" class="slide-img" loading="lazy">
                                            {% endif %}
                                        </div>
                                    {% endfor %}
                                
                                {% elsif project.video_id %}
                                    <div class="media-item active">
                                        <div class="video-container">
                                            <iframe src="https://www.youtube.com/embed/{{ project.video_id }}" frameborder="0" loading="lazy" allowfullscreen></iframe>
                                        </div>
                                    </div>
                                {% elsif project.image %}
                                    <div class="media-item active">
                                        <img src="{{ project.image | relative_url }}" alt="{{ project.title | escape }}" class="slide-img" loading="lazy">
                                    </div>
                                {% endif %}
                            </div>
    
                            {% if project.gallery.size > 1 %}
                            <div class="media-controls">
                                {% for item in project.gallery %}
                                    <button class="media-dot {% if forloop.first %}active{% endif %}" 
                                            onclick="switchMedia('{{ project_uid }}', {{ forloop.index0 }})">
                                        {{ forloop.index }}
                                    </button>
                                {% endfor %}
                            </div>
                            {% endif %}
                        </div>
                        {% endif %}
                        
                        <div class="slide-text">
                            <p>{{ project.description }}</p>
                            
                            {% if project.repo %}
                            <div class="project-links">
                                <a href="{{ project.repo }}" target="_blank" class="repo-btn">
                                    <i class="fab fa-github"></i> View Code
                                </a>
                            </div>
                            {% endif %}
                        </div>

                    </div> </div> {% endfor %}
            {% else %}
                <div class="project-slide">
                    <div class="slide-text" style="text-align:center; padding-top: 50px;">
                        <h3>No projects added yet.</h3>
                        <p>Check back soon!</p>
                    </div>
                </div>
            {% endif %}
        </div>
    </div>
    {% endfor %}
</div>

<script>
    // 1. Tab Switching Logic
    function openCategory(categoryName, tab) {
        var containers = document.getElementsByClassName("category-container");
        for (var i = 0; i < containers.length; i++) {
            containers[i].style.display = "none";
        }
        
        var tabs = document.getElementsByClassName("tab-btn");
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.remove("active");
        }

        document.getElementById(categoryName).style.display = "block";
        tab.classList.add("active");
    }

    // 2. Media Switcher Logic (The 1-2-3 buttons)
    function switchMedia(projectUid, mediaIndex) {
        var container = document.getElementById("display-" + projectUid);
        var items = container.getElementsByClassName("media-item");
        
        for (var i = 0; i < items.length; i++) {
            items[i].classList.remove("active");
        }
        
        items[mediaIndex].classList.add("active");

        var controls = container.nextElementSibling;
        if (controls && controls.classList.contains("media-controls")) {
            var buttons = controls.getElementsByClassName("media-dot");
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].classList.remove("active");
            }
            buttons[mediaIndex].classList.add("active");
        }
    }
</script>
