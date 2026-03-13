import { NextRequest, NextResponse } from 'next/server';
import { getTemplates, getTemplateByName, createTemplate } from '@/lib/db';

/**
 * GET /api/templates - List all templates
 */
export async function GET() {
  try {
    const templates = await getTemplates();

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates - Create a new template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, displayName, description, activities } = body;

    if (!name || !displayName) {
      return NextResponse.json(
        { error: 'Name and displayName are required' },
        { status: 400 }
      );
    }

    // Check if template already exists
    const existing = await getTemplateByName(name);
    if (existing) {
      return NextResponse.json(
        { error: 'Template with this name already exists' },
        { status: 409 }
      );
    }

    const template = await createTemplate({
      name,
      display_name: displayName,
      description: description || '',
      activities: activities || []
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
