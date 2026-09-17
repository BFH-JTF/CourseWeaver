# Department
A department is an academic unit organized around a particular subject or discipline. Departments commonly manage programs, teach modules, conduct research, and support academic administration.
- id
- name
- description
- contact
- URL

# Program
A program is a structured course of study designed to develop knowledge and skills in a particular academic or professional area. It defines the subjects students must complete, the learning outcomes they must achieve, and the requirements for graduation. Programs may lead to different degrees or include specializations, concentrations, or pathways.
- id
- name
- description
- departmentIDs (array)
- contact
- URL

# Degree
A degree is an academic qualification awarded to a student who successfully completes the requirements of a program. Examples include a Bachelor’s degree in Business Administration, a Master’s degree in Psychology, or a Doctoral degree in Physics.
- id
- name
- description
- programIDs (array)
- contact
- URL

# Module
A module is an individual unit of study within a program, focused on a particular topic or set of learning outcomes. It usually includes teaching activities, readings, assignments, examinations, and a specified number of academic credits. Programs typically combine compulsory modules with optional or elective modules.
- id
- name
- description
- degreeIDs (array)
- contact
- URL

# Class
- id
- name
- description
- moduleIDs (array)
- class availability
- expected class size