/*
  春晓画室 - 管理端总览统计
*/

// ============================================================
//  总览统计
// ============================================================
function updateOverview() {
  var students = getStudents();
  var artworks = getArtworks();
  var inquiries = getInquiries();
  var unread = inquiries.filter(function(i) { return !i.read; }).length;

  var statNumbers = document.querySelectorAll('.stat-number');
  if (statNumbers.length >= 4) {
    statNumbers[0].textContent = students.length;
    statNumbers[1].textContent = getCourses().length;
    statNumbers[2].textContent = artworks.length;
    statNumbers[3].textContent = unread;
  }
}
