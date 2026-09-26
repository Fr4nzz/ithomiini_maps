const assignmentLabels = {
  exact_subspecies: 'Matched to subspecies',
  species_unambiguous_subspecies: 'Inferred from agreeing subspecies',
  dore_record: 'Reported by Doré et al.',
  unassigned: 'Unassigned',
}

export function mimicryAssignmentLabel(record) {
  return assignmentLabels[record?.mimicry_assignment_level] || 'Assignment not recorded'
}
