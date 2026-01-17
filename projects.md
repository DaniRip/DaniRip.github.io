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
                    
                    <div class="slide-content">
                        
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
                                    {% endfor %}
                                
                                {% elsif project.video_id %}
                                    <div class="media-item active">
                                        <div class="video-container">
                                            <iframe src="https://www.youtube.com/embed/{{ project.video_id }}" frameborder="0" allowfullscreen></iframe>
                                        </div>
                                    </div>
                                {% elsif project.image %}
                                    <div class="media-item active">
                                        <img src="{{ project.image | relative_url }}" alt="Project Visual" class="slide-img">
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
                    </div>

                </div>
                {% endfor %}
            {% else %}
                <div class="project-slide visible">
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
    function openCategory(categoryName) {
        var containers = document.getElementsByClassName("category-container");
        for (var i = 0; i < containers.length; i++) {
            containers[i].style.display = "none";
        }
        
        var tabs = document.getElementsByClassName("tab-btn");
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].className = tabs[i].className.replace(" active", "");
        }

        document.getElementById(categoryName).style.display = "block";
        event.currentTarget.className += " active";
    }

    // 2. Slide Switching Logic
    var slideIndices = {
        'active': 0,
        'completed': 0,
        'fun': 0,
        'future': 0
    };

    function changeSlide(n, category) {
        var container = document.getElementById(category);
        var slides = container.getElementsByClassName("project-slide");
        
        slides[slideIndices[category]].classList.remove("visible");

        slideIndices[category] += n;

        if (slideIndices[category] >= slides.length) { slideIndices[category] = 0; }
        if (slideIndices[category] < 0) { slideIndices[category] = slides.length - 1; }

        slides[slideIndices[category]].classList.add("visible");
    }

    // 3. Media Switcher Logic (The 1-2-3 buttons)
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
